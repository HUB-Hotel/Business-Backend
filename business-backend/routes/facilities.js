const express = require("express");
const router = express.Router();
const Facility = require("../models/Facility");
const Hotel = require("../models/Hotel");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 편의시설 생성 (호텔 등록 시 함께 생성)
router.post("/", async (req, res) => {
  try {
    const { service_name, service_detail, hotel_id } = req.body;

    if (!service_name || !hotel_id) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // 호텔 소유권 확인
    const hotel = await Hotel.findOne({
      _id: hotel_id,
      business: req.user.id
    });

    if (!hotel) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    // 기존 편의시설이 있으면 업데이트, 없으면 생성
    let facility = await Facility.findById(hotel.facility_id);
    
    if (facility) {
      facility.service_name = service_name;
      facility.service_detail = service_detail || "";
      await facility.save();
    } else {
      facility = await Facility.create({
        service_name,
        service_detail: service_detail || ""
      });
      
      // 호텔에 편의시설 ID 연결
      hotel.facility_id = facility._id;
      await hotel.save();
    }

    res.status(201).json(facility);
  } catch (error) {
    console.error("POST /api/facilities 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 호텔별 편의시설 조회
router.get("/hotel/:hotelId", async (req, res) => {
  try {
    const { hotelId } = req.params;
    const businessId = req.user.id;

    const hotel = await Hotel.findOne({
      _id: hotelId,
      business: businessId
    });

    if (!hotel) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    if (!hotel.facility_id) {
      return res.json(null);
    }

    const facility = await Facility.findById(hotel.facility_id);
    res.json(facility);
  } catch (error) {
    console.error("GET /api/facilities/hotel/:hotelId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 편의시설 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { service_name, service_detail } = req.body;

    // 편의시설이 속한 호텔 확인
    const hotel = await Hotel.findOne({
      facility_id: req.params.id,
      business: req.user.id
    });

    if (!hotel) {
      return res.status(404).json({ message: "편의시설을 찾을 수 없거나 권한이 없습니다." });
    }

    const facility = await Facility.findById(req.params.id);
    if (!facility) {
      return res.status(404).json({ message: "편의시설을 찾을 수 없습니다." });
    }

    const updates = {};
    if (service_name !== undefined) updates.service_name = service_name;
    if (service_detail !== undefined) updates.service_detail = service_detail;

    const updated = await Facility.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/facilities/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

