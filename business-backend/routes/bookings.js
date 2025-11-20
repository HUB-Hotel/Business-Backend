const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Room = require("../models/Room");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 예약 목록 조회 (필터링 지원)
router.get("/", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { status, lodgingId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { business_id: business._id };

    if (status) {
      query.booking_status = status;
    }

    if (lodgingId) {
      const rooms = await Room.find({ lodging_id: lodgingId }).select('_id');
      const roomIds = rooms.map(r => r._id);
      if (roomIds.length > 0) {
        query.room_id = { $in: roomIds };
      } else {
        query.room_id = { $in: [] };
      }
    }

    if (startDate || endDate) {
      query.checkin_date = {};
      if (startDate) {
        query.checkin_date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.checkin_date.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('room_id', 'room_name price')
        .populate('user_id', 'email user_name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    const bookingsWithPayment = await Promise.all(
      bookings.map(async (booking) => {
        const [room, user, payment] = await Promise.all([
          Room.findById(booking.room_id).lean(),
          User.findById(booking.user_id).select('-password').lean(),
          Payment.findOne({ booking_id: booking._id })
            .populate('payment_type_id')
            .lean()
        ]);
        
        return {
          booking: booking,
          room: room || null,
          user: user || null,
          payment: payment || null
        };
      })
    );

    res.json({
      bookings: bookingsWithPayment,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("GET /api/bookings 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 예약 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const [room, user, payment] = await Promise.all([
      Room.findById(booking.room_id).lean(),
      User.findById(booking.user_id).select('-password').lean(),
      Payment.findOne({ booking_id: booking._id })
        .populate('payment_type_id')
        .lean()
    ]);

    res.json({
      booking: booking.toObject(),
      room: room || null,
      user: user || null,
      payment: payment || null
    });
  } catch (error) {
    console.error("GET /api/bookings/:id 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 예약 상태 변경 (승인/취소)
router.patch("/:id/status", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { status, cancellationReason } = req.body;

    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ message: "유효하지 않은 상태입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const updates = { booking_status: status };
    
    if (status === 'cancelled') {
      const payment = await Payment.findOne({ booking_id: req.params.id });
      if (payment) {
        payment.paid = 0;
        await payment.save();
      }
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('room_id', 'room_name price')
      .populate('user_id', 'email user_name');

    const payment = await Payment.findOne({ booking_id: updated._id })
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
      payment: payment || null
    });
  } catch (error) {
    console.error("PATCH /api/bookings/:id/status 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 결제 상태 변경
router.patch("/:id/payment", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { paymentStatus, paymentMethod } = req.body;

    if (!paymentStatus || !['pending', 'paid', 'refunded', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ message: "유효하지 않은 결제 상태입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const payment = await Payment.findOne({ booking_id: req.params.id });
    if (payment) {
      if (paymentStatus === 'paid') {
        payment.paid = payment.total;
      } else if (paymentStatus === 'refunded') {
        payment.paid = 0;
      }
      await payment.save();
    }

    const updated = await Booking.findById(req.params.id)
      .populate('room_id', 'room_name price')
      .populate('user_id', 'email user_name');

    const updatedPayment = await Payment.findOne({ booking_id: req.params.id })
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
      payment: updatedPayment || null
    });
  } catch (error) {
    console.error("PATCH /api/bookings/:id/payment 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;
