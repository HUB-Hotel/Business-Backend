const express = require("express");
const router = express.Router();
const Notice = require("../models/Notice");
const Room = require("../models/Room");
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 공지사항 생성/수정 (객실당 하나만 존재)
router.post("/", async (req, res) => {
  try {
    const { room_id, content, usage_guide, introduction } = req.body;

    if (!room_id) {
      return res.status(400).json({ message: "room_id는 필수입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const room = await Room.findById(room_id).populate('lodging_id');
    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    let notice = await Notice.findOne({ room_id });
    
    if (notice) {
      if (content !== undefined) notice.content = content;
      if (usage_guide !== undefined) notice.usage_guide = usage_guide;
      if (introduction !== undefined) notice.introduction = introduction;
      await notice.save();
    } else {
      notice = await Notice.create({
        room_id,
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

// 객실별 공지사항 조회 (레거시 엔드포인트)
router.get("/own-hotel/:ownHotelId", async (req, res) => {
  try {
    const { ownHotelId } = req.params;

    const room = await Room.findById(ownHotelId).populate('lodging_id');
    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const notice = await Notice.findOne({ room_id: ownHotelId });
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

    const room = await Room.findById(notice.room_id).populate('lodging_id');
    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
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

// 객실별 공지사항 조회
router.get("/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId).populate('lodging_id');
    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const notice = await Notice.findOne({ room_id: roomId });
    res.json(notice || null);
  } catch (error) {
    console.error("GET /api/notices/room/:roomId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;

