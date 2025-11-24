const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const ReviewReport = require("../models/ReviewReport");
const Booking = require("../models/Booking");
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const Room = require("../models/Room");
const { authenticateToken } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/roles");

// 리뷰 작성 (USER만, 예약 이력 확인)
router.post("/", authenticateToken, requireRole("USER"), async (req, res) => {
  try {
    const { lodging_id, booking_id, rating, content, images } = req.body;
    const user_id = req.user.id;

    // 필수 필드 검증
    if (!lodging_id || !booking_id || !rating || !content) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // 평점 범위 검증
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "평점은 1부터 5까지입니다." });
    }

    // 예약 이력 확인
    const booking = await Booking.findOne({
      _id: booking_id,
      user_id: user_id,
      booking_status: { $in: ['confirmed', 'completed'] }
    });

    if (!booking) {
      return res.status(403).json({ message: "리뷰를 작성할 권한이 없습니다. 확인된 예약 이력이 필요합니다." });
    }

    // 해당 예약의 room_id로 lodging_id 확인
    const room = await Room.findById(booking.room_id);
    if (!room) {
      return res.status(404).json({ message: "객실 정보를 찾을 수 없습니다." });
    }

    if (room.lodging_id.toString() !== lodging_id) {
      return res.status(400).json({ message: "예약한 호텔과 리뷰 작성 대상 호텔이 일치하지 않습니다." });
    }

    // 이미 리뷰를 작성했는지 확인
    const existingReview = await Review.findOne({ booking_id: booking_id });
    if (existingReview) {
      return res.status(400).json({ message: "이미 해당 예약에 대한 리뷰를 작성하셨습니다." });
    }

    // 리뷰 생성
    const review = new Review({
      lodging_id,
      user_id,
      booking_id,
      rating,
      content,
      images: images || []
    });

    await review.save();

    // 리뷰 정보와 함께 사용자 정보 포함하여 반환
    const populatedReview = await Review.findById(review._id)
      .populate('user_id', 'user_name profile_image')
      .populate('lodging_id', 'lodging_name')
      .lean();

    res.status(201).json({
      message: "리뷰가 작성되었습니다.",
      review: populatedReview
    });
  } catch (error) {
    console.error("POST /api/reviews 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 리뷰 신고 (BUSINESS만)
router.post("/:id/report", authenticateToken, requireRole("BUSINESS"), async (req, res) => {
  try {
    const review_id = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: "신고 사유를 입력해주세요." });
    }

    // 리뷰 확인
    const review = await Review.findById(review_id).populate('lodging_id', 'business_id');
    if (!review) {
      return res.status(404).json({ message: "리뷰를 찾을 수 없습니다." });
    }

    // 사업자 정보 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 해당 호텔의 소유자인지 확인
    if (review.lodging_id.business_id.toString() !== business._id.toString()) {
      return res.status(403).json({ message: "해당 호텔의 소유자만 리뷰를 신고할 수 있습니다." });
    }

    // 이미 신고했는지 확인
    const existingReport = await ReviewReport.findOne({
      review_id: review_id,
      business_id: business._id
    });

    if (existingReport) {
      return res.status(400).json({ message: "이미 해당 리뷰를 신고하셨습니다." });
    }

    // 신고 생성
    const report = new ReviewReport({
      review_id,
      business_id: business._id,
      reason: reason.trim()
    });

    await report.save();

    res.status(201).json({
      message: "리뷰가 신고되었습니다.",
      report: {
        _id: report._id,
        review_id: report.review_id,
        reason: report.reason,
        status: report.status,
        reported_at: report.reported_at
      }
    });
  } catch (error) {
    console.error("POST /api/reviews/:id/report 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 리뷰 차단 (BUSINESS만)
router.patch("/:id/block", authenticateToken, requireRole("BUSINESS"), async (req, res) => {
  try {
    const review_id = req.params.id;

    // 리뷰 확인
    const review = await Review.findById(review_id).populate('lodging_id', 'business_id');
    if (!review) {
      return res.status(404).json({ message: "리뷰를 찾을 수 없습니다." });
    }

    // 사업자 정보 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 해당 호텔의 소유자인지 확인
    if (review.lodging_id.business_id.toString() !== business._id.toString()) {
      return res.status(403).json({ message: "해당 호텔의 소유자만 리뷰를 차단할 수 있습니다." });
    }

    // 이미 차단된 리뷰인지 확인
    if (review.status === 'blocked') {
      return res.status(400).json({ message: "이미 차단된 리뷰입니다." });
    }

    // 리뷰 차단
    review.status = 'blocked';
    review.blocked_at = new Date();
    await review.save();

    res.json({
      message: "리뷰가 차단되었습니다.",
      review: {
        _id: review._id,
        status: review.status,
        blocked_at: review.blocked_at
      }
    });
  } catch (error) {
    console.error("PATCH /api/reviews/:id/block 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 차단된 리뷰 목록 조회 (BUSINESS만)
router.get("/blocked", authenticateToken, requireRole("BUSINESS"), async (req, res) => {
  try {
    // 사업자 정보 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 해당 사업자의 호텔 목록 조회
    const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
    const lodgingIds = lodgings.map(l => l._id);

    // 차단된 리뷰 조회
    const blockedReviews = await Review.find({
      lodging_id: { $in: lodgingIds },
      status: 'blocked'
    })
      .populate('user_id', 'user_name profile_image')
      .populate('lodging_id', 'lodging_name')
      .sort({ blocked_at: -1 })
      .lean();

    res.json({
      count: blockedReviews.length,
      reviews: blockedReviews
    });
  } catch (error) {
    console.error("GET /api/reviews/blocked 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 신고 내역 조회 (ADMIN만)
router.get("/reports", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 필터 조건
    const filter = {};
    if (status && ['pending', 'reviewed', 'rejected'].includes(status)) {
      filter.status = status;
    }

    // 신고 내역 조회
    const reports = await ReviewReport.find(filter)
      .populate({
        path: 'review_id',
        select: 'rating content status created_at',
        populate: [
          {
            path: 'lodging_id',
            select: 'lodging_name'
          },
          {
            path: 'user_id',
            select: 'user_name'
          }
        ]
      })
      .populate('business_id', 'business_name')
      .populate('reviewed_by', 'user_name')
      .sort({ reported_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // 전체 개수
    const total = await ReviewReport.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      reports: reports
    });
  } catch (error) {
    console.error("GET /api/reviews/reports 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

