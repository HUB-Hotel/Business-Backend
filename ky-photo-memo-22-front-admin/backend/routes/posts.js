const express = require("express");
const router = express.Router();
const Post = require("../models/Posts");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { authenticateToken } = require("../middlewares/auth");
const { deleteObject } = require("../src/s3");

const S3_BASE_URL =
  process.env.S3_BASE_URL ||
  `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`; // 추가됨

function urlToKey(u) {
  if (!u) return "";
  const s = String(u);
  if (!/^https?:\/\//i.test(s)) return s; // 이미 key
  const base = String(S3_BASE_URL || "").replace(/\/+$/, "");
  return s.startsWith(base + "/") ? s.slice(base.length + 1) : s;
}

function joinS3Url(base, key) {
  // 추가됨
  const b = String(base || "").replace(/\/+$/, "");
  const k = String(key || "").replace(/^\/+/, "");
  return `${b}/${k}`;
}

const toArray = (val) => {
  // 추가됨: fileUrl/string/JSON 문자열 안전 파싱
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [val];
    } catch {
      return [val];
    }
  }
  return [];
};

const ensureObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "잘못된 id 형식입니다." });
  }
  next();
};

const pickDefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { title, content, fileUrl, imageUrl } = req.body;

    let files = toArray(fileUrl); // 추가됨
    if (!files.length && imageUrl) files = toArray(imageUrl); // 추가됨

    const uid = req.user._id || req.user.id; // 변경됨: 사용자 id 통일 처리
    const latest = await Post.findOne({ user: uid }).sort({ number: -1 }); // 변경됨: 사용자별 number 증가

    const nextNumber = latest ? Number(latest.number) + 1 : 1; // 변경됨

    const post = await Post.create({
      user: uid, // 변경됨
      number: nextNumber, // 변경됨
      title,
      content,
      fileUrl: files, // 변경됨: key 배열 저장
      imageUrl,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("POST /api/posts 실패:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

router.get("/", async (req, res) => {
  try {
    const list = await Post.find().sort({ createdAt: -1 }).lean();

    const data = list.map((p) => {
      // 추가됨
      const raw = Array.isArray(p.fileUrl)
        ? p.fileUrl
        : p.imageUrl
        ? [p.imageUrl]
        : [];

      const keys = raw.filter((v) => typeof v === "string" && v.length > 0);
      const urls = keys.map((v) =>
        v.startsWith("http") ? v : joinS3Url(S3_BASE_URL, v)
      );

      return { ...p, fileUrl: urls };
    });

    res.json(data);
  } catch (error) {
    console.error("GET /api/posts 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});
router.get("/my", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    if (!userId) return res.status(400).json({ message: "유저 정보 없음" });

    const myPosts = await Post.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    // 변경됨: /my도 fileUrl 절대 URL로 통일
    const data = myPosts.map((p) => {
      // 추가됨
      const raw = Array.isArray(p.fileUrl)
        ? p.fileUrl
        : p.imageUrl
        ? [p.imageUrl]
        : [];
      const keys = raw.filter((v) => typeof v === "string" && v.length > 0);
      const urls = keys.map((v) =>
        v.startsWith("http") ? v : joinS3Url(S3_BASE_URL, v)
      );
      return { ...p, fileUrl: urls };
    });

    res.json(data);
  } catch (error) {
    console.error("GET /api/posts/my 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const doc = await Post.findById(req.params.id).lean();

    if (!doc) return res.status(404).json({ message: "존재하지 않는 게시글" });

    const keys = Array.isArray(doc.fileUrl)
      ? doc.fileUrl
      : doc.imageUrl
      ? [doc.imageUrl]
      : []; // 추가됨
    const urls = keys
      .filter((v) => typeof v === "string" && v.length > 0)
      .map((v) => (v.startsWith("http") ? v : joinS3Url(S3_BASE_URL, v))); // 추가됨

    res.json({ ...doc, fileUrl: urls });
  } catch (error) {
    res.status(500).json({ message: "서버 오류" });
  }
});
/** UPDATE */
router.put("/:id", authenticateToken, ensureObjectId, async (req, res) => {
  // 변경됨: ensureObjectId 추가
  try {
    const { title, content, fileUrl, imageUrl } = req.body;

    const before = await Post.findById(req.params.id)
      .select("user fileUrl imageUrl")
      .lean();

    if (!before)
      return res.status(404).json({ message: "존재하지 않는 게시글" });

    const uid = String(req.user.id || req.user._id); // 추가됨
    if (String(before.user) !== uid) {
      return res.status(403).json({ message: "권한이 없습니다." }); // 추가됨
    }

    // 변경됨: undefined 필드로 기존값 덮어쓰지 않도록 필터링
    const updates = pickDefined({
      title,
      content,
      fileUrl: fileUrl !== undefined ? toArray(fileUrl) : undefined, // 변경됨: 안전 변환
      imageUrl,
    });
    const oldKeys = [
      ...(Array.isArray(before.fileUrl) ? before.fileUrl : []),
      ...(before.imageUrl ? [before.imageUrl] : []),
    ]
      .map(urlToKey) // 절대경로 → S3 키 변환
      .filter(Boolean);

    const newKeys = [
      ...(updates.fileUrl !== undefined
        ? updates.fileUrl // 새 fileUrl이 있을 경우
        : Array.isArray(before.fileUrl)
        ? before.fileUrl // 없으면 기존 값 유지
        : []),
      ...(updates.imageUrl !== undefined
        ? [updates.imageUrl]
        : before.imageUrl
        ? [before.imageUrl]
        : []),
    ]
      .map(urlToKey)
      .filter(Boolean);

    const toDelete = oldKeys.filter((k) => !newKeys.includes(k));

    if (toDelete.length) {
      const results = await Promise.allSettled(
        toDelete.map((k) => deleteObject(k))
      );

      // ⚠️ 실패한 항목 로그 남기기 (전체 실패 방지는 아님)
      const fail = results.filter((r) => r.status === "rejected");
      if (fail.length) {
        console.warn(
          "[S3 Delete Partial Fail]",
          fail.map((f) => f.reason?.message || f.reason)
        );
      }
    }

    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/posts/:id 실패", error); // 추가됨: 로깅 강화
    res.status(500).json({ message: "서버 오류" });
  }
});

router.delete("/:id", authenticateToken, ensureObjectId, async (req, res) => {
  try {
    // 추가됨: 소유권 검증(본인 글만 삭제)
    const doc = await Post.findById(req.params.id).select(
      "user fileUrl imageUrl"
    ); // 추가됨
    if (!doc) return res.status(404).json({ message: "존재하지 않는 게시글" });

    const uid = String(req.user.id || req.user._id); // 추가됨
    if (String(doc.user) !== uid) {
      return res.status(403).json({ message: "권한이 없습니다." }); // 추가됨
    }

    const keys = [
      ...(Array.isArray(doc.fileUrl) ? doc.fileUrl : []),
      ...(doc.imageUrl ? [doc.imageUrl] : []),
    ]
      .map(urlToKey)
      .filter(Boolean);

    if (keys.length) {
      const results = await Promise.allSettled(
        keys.map((k) => deleteObject(k))
      );
      const fail = results.filter((r) => r.status === "rejected");
      if (fail.length) {
        console.warn(
          "[S3 Delete Partial Fail]",
          fail.map((f) => f.reason?.message || f.reason)
        );
      }
    }
    await doc.deleteOne(); // 변경됨: 안전 삭제
    res.json({ ok: true, id: doc._id });
  } catch (error) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
