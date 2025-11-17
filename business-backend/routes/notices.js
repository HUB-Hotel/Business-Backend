const express = require("express");
const router = express.Router();
const Notice = require("../models/Notice");
const OwnHotel = require("../models/OwnHotel");
const Hotel = require("../models/Hotel");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 공지사항 생성/수정 (own_hotel_id당 하나만 존재)
router.post("/", async (req, res) => {
  try {
    const { own_hotel_id, content, usage_guide, introduction } = req.body;

    if (!own_hotel_id) {
      return res.status(400).json({ message: "own_hotel_id는 필수입니다." });
    }

    // 소유 숙소 소유권 확인
    const ownHotel = await OwnHotel.findById(own_hotel_id).populate('hotel_id');
    if (!ownHotel) {
      return res.status(404).json({ message: "소유 숙소를 찾을 수 없습니다." });
    }

    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // 기존 공지사항이 있으면 업데이트, 없으면 생성
    let notice = await Notice.findOne({ own_hotel_id });
    
    if (notice) {
      if (content !== undefined) notice.content = content;
      if (usage_guide !== undefined) notice.usage_guide = usage_guide;
      if (introduction !== undefined) notice.introduction = introduction;
      await notice.save();
    } else {
      notice = await Notice.create({
        own_hotel_id,
        content: content || "",
        usage_guide: usage_guide || "",
        introduction: introduction || ""
      });
    }

    res.status(201).json(notice);
  } catch (error) {
    console.error("POST /api/notices 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 소유 숙소별 공지사항 조회
router.get("/own-hotel/:ownHotelId", async (req, res) => {
  try {
    const { ownHotelId } = req.params;

    const ownHotel = await OwnHotel.findById(ownHotelId).populate('hotel_id');
    if (!ownHotel) {
      return res.status(404).json({ message: "소유 숙소를 찾을 수 없습니다." });
    }

    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const notice = await Notice.findOne({ own_hotel_id: ownHotelId });
    res.json(notice || null);
  } catch (error) {
    console.error("GET /api/notices/own-hotel/:ownHotelId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 공지사항 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { content, usage_guide, introduction } = req.body;

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
    }

    // 소유권 확인
    const ownHotel = await OwnHotel.findById(notice.own_hotel_id).populate('hotel_id');
    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const updates = {};
    if (content !== undefined) updates.content = content;
    if (usage_guide !== undefined) updates.usage_guide = usage_guide;
    if (introduction !== undefined) updates.introduction = introduction;

    const updated = await Notice.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/notices/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

