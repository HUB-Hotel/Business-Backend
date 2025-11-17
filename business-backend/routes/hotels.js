const express = require("express");
const router = express.Router();
const Hotel = require("../models/Hotel");
const Facility = require("../models/Facility");
const OwnHotel = require("../models/OwnHotel");
const Reservation = require("../models/Reservation");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");


// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 내 호텔 목록 조회
router.get("/", async (req, res) => {
  try {
    const businessId = req.user.id;
    const hotels = await Hotel.find({ business: businessId })
      .populate('facility_id')
      .sort({ createdAt: -1 })
      .lean();

    res.json(hotels);
  } catch (error) {
    console.error("GET /api/hotels 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 호텔 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const hotel = await Hotel.findOne({
      _id: req.params.id,
      business: req.user.id
    })
      .populate('facility_id');

    if (!hotel) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    res.json(hotel);
  } catch (error) {
    console.error("GET /api/hotels/:id 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 호텔 생성
router.post("/", async (req, res) => {
  try {
    const {
      name,
      location,
      tel,
      owner,
      business_number,
      regist_number,
      region,
      service_name,
      service_detail
    } = req.body;

    if (!name || !location || !owner || !business_number || !region) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // 편의시설 먼저 생성
    let facility = null;
    if (service_name) {
      facility = await Facility.create({
        service_name,
        service_detail: service_detail || ""
      });
    } else {
      // 기본 편의시설 생성
      facility = await Facility.create({
        service_name: "기본 편의시설",
        service_detail: ""
      });
    }

    const hotel = await Hotel.create({
      business: req.user.id,
      name,
      location,
      tel: tel || "",
      owner,
      business_number,
      regist_number: regist_number || "",
      region,
      facility_id: facility._id
    });

    const createdHotel = await Hotel.findById(hotel._id)
      .populate('facility_id');

    res.status(201).json(createdHotel);
  } catch (error) {
    console.error("POST /api/hotels 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 호텔 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const hotel = await Hotel.findOne({
      _id: req.params.id,
      business: req.user.id
    });

    if (!hotel) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    const {
      name,
      location,
      tel,
      owner,
      business_number,
      regist_number,
      region
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (tel !== undefined) updates.tel = tel;
    if (owner !== undefined) updates.owner = owner;
    if (business_number !== undefined) updates.business_number = business_number;
    if (regist_number !== undefined) updates.regist_number = regist_number;
    if (region !== undefined) updates.region = region;

    const updated = await Hotel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('facility_id');

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/hotels/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 호텔 삭제
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const hotel = await Hotel.findOne({
      _id: req.params.id,
      business: req.user.id
    });

    if (!hotel) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    // 예약이 있는지 확인
    const hasReservations = await Reservation.exists({ hotel_id: req.params.id });
    if (hasReservations) {
      return res.status(400).json({ message: "예약이 있어 호텔을 삭제할 수 없습니다." });
    }

    // 소유 숙소도 함께 삭제
    await OwnHotel.deleteMany({ hotel_id: req.params.id });
    await hotel.deleteOne();

    res.json({ ok: true, id: hotel._id });
  } catch (error) {
    console.error("DELETE /api/hotels/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

