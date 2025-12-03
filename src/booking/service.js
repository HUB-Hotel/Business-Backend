const Booking = require("./model");
const Payment = require("./payment");
const PaymentType = require("./paymentType");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const User = require("../auth/model");
const Business = require("../auth/business");
const mongoose = require("mongoose");

// 예약 가능 여부 체크 (트랜잭션 내에서 사용)
const checkRoomAvailability = async (roomId, checkinDate, checkoutDate, session) => {
  // 날짜가 겹치는 기존 예약 조회
  // 겹침 조건: 새 예약의 체크인이 기존 예약의 체크아웃 전이고, 새 예약의 체크아웃이 기존 예약의 체크인 후
  const overlappingBookings = await Booking.countDocuments({
    roomId: roomId,
    bookingStatus: { $in: ['pending', 'confirmed'] }, // pending과 confirmed만 카운트
    $and: [
      { checkinDate: { $lt: checkoutDate } }, // 새 예약의 체크인이 기존 예약의 체크아웃 전
      { checkoutDate: { $gt: checkinDate } }  // 새 예약의 체크아웃이 기존 예약의 체크인 후
    ]
  }).session(session);

  return overlappingBookings;
};

// 예약 생성 (트랜잭션 사용)
const createBooking = async (bookingData, userId, userRole) => {
  const { room_id, user_id, adult, child, checkin_date, checkout_date, duration } = bookingData;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 트랜잭션 내에서 Room 조회
    const room = await Room.findById(room_id).session(session);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    // Lodging 조회를 통해 businessId 가져오기
    const lodging = await Lodging.findById(room.lodgingId).session(session);
    if (!lodging) {
      throw new Error("LODGING_NOT_FOUND");
    }

    const businessId = lodging.businessId;

    // 인원 수가 Room의 수용 인원 범위 내인지 확인
    const totalGuests = (Number(adult) || 0) + (Number(child) || 0);
    
    if (totalGuests < room.capacityMin || totalGuests > room.capacityMax) {
      throw new Error("INVALID_GUEST_COUNT");
    }

    // 예약 가능 여부 체크 (트랜잭션 내에서)
    const existingBookingsCount = await checkRoomAvailability(
      room_id,
      new Date(checkin_date),
      new Date(checkout_date),
      session
    );

    // 방 수량 확인
    if (existingBookingsCount >= room.countRoom) {
      throw new Error("ROOM_NOT_AVAILABLE");
    }

    // User 유효성 검증 (트랜잭션 외부에서 조회해도 됨 - 읽기 전용)
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // 예약 생성 (트랜잭션 내에서, 항상 pending 상태로 시작)
    const booking = await Booking.create([{
      roomId: room_id,
      userId: user_id,
      businessId: businessId,
      adult: adult || 0,
      child: child || 0,
      checkinDate: new Date(checkin_date),
      checkoutDate: new Date(checkout_date),
      duration,
      bookingStatus: 'pending',
      bookingDate: new Date()
    }], { session });

    // 트랜잭션 커밋
    await session.commitTransaction();

    // 트랜잭션 외부에서 관련 데이터 조회 (읽기 전용)
    const bookingObj = booking[0].toObject();
    
    const [roomData, userData, payment] = await Promise.all([
      Room.findById(bookingObj.roomId).lean().catch(() => null),
      User.findById(bookingObj.userId).lean().catch(() => null),
      Payment.findOne({ bookingId: bookingObj._id })
        .populate('paymentTypeId')
        .lean()
        .catch(() => null)
    ]);

    const lodgingData = roomData && roomData.lodgingId
      ? await Lodging.findById(roomData.lodgingId).lean().catch(() => null)
      : null;

    return {
      booking: bookingObj,
      room: roomData || null,
      lodging: lodgingData || null,
      user: userData || null,
      payment: payment || null
    };
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();
    throw error;
  } finally {
    // 세션 종료
    session.endSession();
  }
};

// 예약 목록 조회
const getBookings = async (filters, userId, userRole) => {
  const { status, lodgingId, startDate, endDate, page = 1, limit = 20 } = filters;

  const query = {};

  // 사용자인 경우: 자신의 예약만 조회
  if (userRole === 'user') {
    query.userId = userId;
  } 
  // 사업자인 경우: 자신의 사업 예약만 조회
  else if (userRole === 'business') {
    const business = await Business.findOne({ loginId: userId });
    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }
    query.businessId = business._id;
  } else {
    throw new Error("UNAUTHORIZED");
  }

  if (status) {
    query.bookingStatus = status;
  }

  if (lodgingId) {
    const rooms = await Room.find({ lodgingId: lodgingId }).select('_id');
    const roomIds = rooms.map(r => r._id);
    if (roomIds.length > 0) {
      query.roomId = { $in: roomIds };
    } else {
      query.roomId = { $in: [] };
    }
  }

  if (startDate || endDate) {
    query.checkinDate = {};
    if (startDate) {
      query.checkinDate.$gte = new Date(startDate);
    }
    if (endDate) {
      query.checkinDate.$lte = new Date(endDate);
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Booking.countDocuments(query)
  ]);

  const bookingsWithPayment = await Promise.all(
    bookings.map(async (booking) => {
      try {
        if (!booking.roomId || !booking.userId || !booking._id) {
          return {
            booking: booking,
            room: null,
            lodging: null,
            user: null,
            payment: null
          };
        }

        const [room, user, payment] = await Promise.all([
          Room.findById(booking.roomId).lean().catch(() => null),
          User.findById(booking.userId).lean().catch(() => null),
          Payment.findOne({ bookingId: booking._id })
            .populate('paymentTypeId')
            .lean()
            .catch(() => null)
        ]);
        
        const lodging = room && room.lodgingId 
          ? await Lodging.findById(room.lodgingId).lean().catch(() => null)
          : null;
        
        return {
          booking: booking,
          room: room || null,
          lodging: lodging || null,
          user: user || null,
          payment: payment || null
        };
      } catch (err) {
        console.error("예약 데이터 처리 중 오류:", booking._id, err);
        return {
          booking: booking,
          room: null,
          lodging: null,
          user: null,
          payment: null
        };
      }
    })
  );
  
  const validBookings = bookingsWithPayment.filter(item => item && item.booking);

  return {
    bookings: validBookings,
    total: total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

// 예약 상세 조회
const getBookingById = async (bookingId, userId, userRole) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // 사용자인 경우: 자신의 예약인지 확인
  if (userRole === 'user') {
    if (String(booking.userId) !== String(userId)) {
      throw new Error("UNAUTHORIZED");
    }
  } 
  // 사업자인 경우: 자신의 사업 예약인지 확인
  else if (userRole === 'business') {
    const business = await Business.findOne({ loginId: userId });
    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }
    if (String(booking.businessId) !== String(business._id)) {
      throw new Error("UNAUTHORIZED");
    }
  } else {
    throw new Error("UNAUTHORIZED");
  }

  const [room, user, payment] = await Promise.all([
    Room.findById(booking.roomId).lean(),
    User.findById(booking.userId).lean(),
    Payment.findOne({ bookingId: booking._id })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodgingId).lean() : null;

  return {
    booking: booking.toObject(),
    room: room || null,
    lodging: lodging || null,
    user: user || null,
    payment: payment || null
  };
};

// 예약 상태 변경
const updateBookingStatus = async (bookingId, status, cancellationReason, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    businessId: business._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const updates = { bookingStatus: status };
  
  // 취소 상태일 때만 취소 사유 저장
  if (status === 'cancelled' && cancellationReason) {
    updates.cancellationReason = cancellationReason;
  } else if (status !== 'cancelled') {
    // 취소 상태가 아니면 취소 사유 초기화
    updates.cancellationReason = null;
  }
  
  // Room 정보 조회 (가격 계산용)
  const room = await Room.findById(booking.roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  // 예약 상태에 따른 Payment 처리
  if (status === 'cancelled') {
    // 취소 시: Payment의 paid를 0으로 설정
    const payment = await Payment.findOne({ bookingId: bookingId });
    if (payment) {
      payment.paid = 0;
      await payment.save();
    }
    // 취소 시 결제 상태도 'refunded'로 변경
    updates.paymentStatus = 'refunded';
  } else if (status === 'confirmed' || status === 'completed') {
    // 확정/완료 시: Payment 생성 또는 업데이트
    let payment = await Payment.findOne({ bookingId: bookingId });
    
    // 기본 PaymentType 조회 (첫 번째 타입 사용)
    const defaultPaymentType = await PaymentType.findOne().sort({ typeCode: 1 });
    if (!defaultPaymentType) {
      throw new Error("PAYMENT_TYPE_NOT_FOUND");
    }

    // Room 가격 기반으로 총액 계산
    const basePrice = room.price * booking.duration;
    
    // 할인 적용
    const ownerDiscountAmount = basePrice * (room.ownerDiscount || 0) / 100;
    const platformDiscountAmount = basePrice * (room.platformDiscount || 0) / 100;
    const totalAmount = Math.max(0, basePrice - ownerDiscountAmount - platformDiscountAmount);

    if (payment) {
      // Payment가 있으면 total과 paid 업데이트
      payment.total = totalAmount;
      payment.paid = totalAmount;
      await payment.save();
    } else {
      // Payment가 없으면 생성
      payment = await Payment.create({
        bookingId: bookingId,
        paymentTypeId: defaultPaymentType._id,
        total: totalAmount,
        paid: totalAmount
      });
    }

    // 결제 상태도 'paid'로 변경
    updates.paymentStatus = 'paid';
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  const [roomData, userData, paymentData] = await Promise.all([
    Room.findById(updated.roomId).lean(),
    User.findById(updated.userId).lean(),
    Payment.findOne({ bookingId: updated._id })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = roomData ? await Lodging.findById(roomData.lodgingId).lean() : null;

  return {
    booking: updated.toObject(),
    room: roomData || null,
    lodging: lodging || null,
    user: userData || null,
    payment: paymentData || null
  };
};

// 결제 상태 변경
const updatePaymentStatus = async (bookingId, paymentStatus, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    businessId: business._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // Booking 모델의 paymentStatus 업데이트
  const updates = { paymentStatus: paymentStatus };
  
  const paymentDoc = await Payment.findOne({ bookingId: bookingId });
  if (paymentDoc) {
    if (paymentStatus === 'paid') {
      paymentDoc.paid = paymentDoc.total;
    } else if (paymentStatus === 'refunded') {
      paymentDoc.paid = 0;
    }
    await paymentDoc.save();
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  const [room, user, payment] = await Promise.all([
    Room.findById(updated.roomId).lean(),
    User.findById(updated.userId).lean(),
    Payment.findOne({ bookingId: bookingId })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodgingId).lean() : null;

  return {
    booking: updated.toObject(),
    room: room || null,
    lodging: lodging || null,
    user: user || null,
    payment: payment || null
  };
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus
};

