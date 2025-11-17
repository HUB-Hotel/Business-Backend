const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Posts");
const audit = require("../middlewares/audit");
const { authenticateToken } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/roles");

router.get(
 "/stats",
 authenticateToken,
 requireRole("admin"),
 async (req, res) => {
  const [today, pending, reports] = await Promise.all([
   Post.countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
   }),
   Post.countDocuments({ status: "pending" }),
   Post.aggregate([{ $group: { _id: null, sum: { $sum: "$reportsCount" } } }]),
  ]);
  res.json({ today, pending, reports: reports?.[0]?.sum ?? 0 });
 }
);

router.get(
  "/posts",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { page = 1, size = 20, status, q, user, userId } = req.query;

      const filter = {};
      if (status) filter.status = status;
      if (q) filter.title = { $regex: q, $options: "i" };

      // ✅ 유저 필터: ?user=<id> 또는 ?userId=<id>
      const uid = user || userId;
      if (uid) {
        if (!mongoose.isValidObjectId(uid)) {
          return res.status(400).json({ message: "잘못된 userId 형식" });
        }
        filter.user = new mongoose.Types.ObjectId(uid);
      }

      const items = await Post.find(filter)
        .sort({ updatedAt: -1 })
        .skip((+page - 1) * +size)
        .limit(+size)
        .select("title user status fileUrl updatedAt");

      res.json(items);
    } catch (err) {
      console.error("[ADMIN /posts] error", err);
      res.status(500).json({ message: "서버 오류", error: err.message });
    }
  }
);

router.get(
 "/users",
 authenticateToken,
 requireRole("admin"),
 async (req, res) => {
  const { page = 1, size = 20, role, q } = req.query;

  const filter = {};

  if (role) filter.role = role;

  if (q) {
   filter.$or = [
    { email: { $regex: q, $options: "i" } },
    { displayName: { $regex: q, $options: "i" } },
   ];
  }
  const users = await User.find(filter)
   .sort({ createdAt: -1 })
   .skip((+page - 1) * +size)
   .limit(+size)
   .select("email displayName role isActive createdAt updatedAt");

  const total = await User.countDocuments(filter);

  res.json({ total, users });
 }
);

router.patch(
 "/posts/:id",
 authenticateToken,
 requireRole("admin"),
 audit({
  resource: "post",
  action: "update",
  getTargetId: (req) => req.params.id,
 }),
 async (req, res) => {
  const updates = Object.fromEntries(
   Object.entries(req.body).filter(([, v]) => v !== undefined)
  );

  const updated = await Post.findByIdAndUpdate(req.params.id, updates, {
   new: true,
  });

  if (!updated) return res.status(404).json({ message: "게시물 없음" });

  res.json(updated);
 }
);

router.patch(
 "/users/:id",
 authenticateToken,
 requireRole("admin"),
 audit({
  resource: "user",
  action: "update",
  getTargetId: (req) => req.params.id,
 }),
 async (req, res) => {
  const { role, isActive, resetRock } = req.body;

  const updates = {};

  if (role) updates.role = role;

  if (typeof isActive == "boolean") updates.isActive = isActive;

  if (resetRock) {
   updates.failedLoginAttempts = 0;
   updates.lastLoginAttempt = null;
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
   new: true,
  });

  if (!user) return res.status(404).json({ message: "사용자 없음" });
  res.json(user);
 }
);

module.exports = router;
