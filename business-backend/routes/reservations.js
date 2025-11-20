const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const Payment = require("../models/Payment");
const Hotel = require("../models/Hotel");
const OwnHotel = require("../models/OwnHotel");
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

    const { status, hotelId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { business: business._id };

    if (status) {
      query.status = status;
    }

    if (hotelId) {
      query.hotel_id = hotelId;
    }

    if (startDate || endDate) {
      query.start_date = {};
      if (startDate) {
        query.start_date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.start_date.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .populate('hotel_id', 'name location region')
        .populate('own_hotel_id', 'room_name price')
        .populate('user_id', 'email fullname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Reservation.countDocuments(query)
    ]);

    // 각 예약의 결제 정보 포함
    const reservationsWithPayment = await Promise.all(
      reservations.map(async (reservation) => {
        const payment = await Payment.findOne({ reserve_id: reservation._id })
          .populate('payment_type_id')
          .lean();
        return {
          ...reservation,
          payment: payment || null
        };
      })
    );

    res.json({
      reservations: reservationsWithPayment,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("GET /api/reservations 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 예약 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const reservation = await Reservation.findOne({
      _id: req.params.id,
      business: req.user.id
    })
      .populate('hotel_id')
      .populate('own_hotel_id')
      .populate('user_id');

    if (!reservation) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const payment = await Payment.findOne({ reserve_id: reservation._id })
      .populate('payment_type_id')
      .lean();

    res.json({
      ...reservation.toObject(),
      payment: payment || null
    });
  } catch (error) {
    console.error("GET /api/reservations/:id 실패", error);
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

    const reservation = await Reservation.findOne({
      _id: req.params.id,
      business: req.user.id
    });

    if (!reservation) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const updates = { status };
    
    // 취소 시 결제 환불 처리
    if (status === 'cancelled') {
      const payment = await Payment.findOne({ reserve_id: req.params.id });
      if (payment) {
        payment.paid = 0;
        await payment.save();
      }
    }

    const updated = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('hotel_id', 'name location region')
      .populate('own_hotel_id', 'room_name price')
      .populate('user_id', 'email fullname');

    const payment = await Payment.findOne({ reserve_id: updated._id })
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
      payment: payment || null
    });
  } catch (error) {
    console.error("PATCH /api/reservations/:id/status 실패", error);
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

    const reservation = await Reservation.findOne({
      _id: req.params.id,
      business: req.user.id
    });

    if (!reservation) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    // Payment 모델 업데이트
    const payment = await Payment.findOne({ reserve_id: req.params.id });
    if (payment) {
      if (paymentStatus === 'paid') {
        payment.paid = payment.total;
      } else if (paymentStatus === 'refunded') {
        payment.paid = 0;
      }
      await payment.save();
    }

    const updated = await Reservation.findById(req.params.id)
      .populate('hotel_id', 'name location region')
      .populate('own_hotel_id', 'room_name price')
      .populate('user_id', 'email fullname');

    const updatedPayment = await Payment.findOne({ reserve_id: req.params.id })
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
      payment: updatedPayment || null
    });
  } catch (error) {
    console.error("PATCH /api/reservations/:id/payment 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

