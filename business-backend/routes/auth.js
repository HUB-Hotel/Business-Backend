const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Business = require("../models/Business");
const { authenticateToken } = require('../middlewares/auth');

const LOCK_MAX = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10분

function makeToken(business) {
  return jwt.sign(
    {
      id: business._id.toString(),
      role: business.role,
      email: business.email,
      tokenVersion: business.tokenVersion || 0
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      jwtid: `${business._id}-${Date.now()}`,
    }
  );
}

// 회원가입
router.post("/register", async (req, res) => {
  try {
    const { email, password, businessName, ownerName, phone, businessNumber, address } = req.body;

    if (!email || !password || !businessName) {
      return res.status(400).json({ message: "이메일/비밀번호/사업자명은 필수입니다." });
    }

    const exists = await Business.findOne({
      email: email.toLowerCase()
    });

    if (exists) {
      return res.status(400).json({ message: "이미 가입된 이메일" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const business = await Business.create({
      email: email.toLowerCase(),
      passwordHash,
      businessName,
      ownerName: ownerName || "",
      phone: phone || "",
      businessNumber: businessNumber || "",
      address: address || "",
      role: "business"
    });

    res.status(201).json({ business: business.toSafeJSON() });
  } catch (error) {
    return res.status(500).json({
      message: "회원가입 실패",
      error: error.message
    });
  }
});

// 로그인
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    const password = String(req.body?.password || "");

    const invalidMsg = { message: "이메일 또는 비밀번호가 올바르지 않습니다." };

    if (!email || !password) {
      return res.status(400).json({
        ...invalidMsg,
        remainingAttempts: null,
        locked: false
      });
    }

    const business = await Business.findOne({ email }).select(
      "+passwordHash +role +isActive +failedLoginAttempts +lastLoginAttempt +tokenVersion"
    );

    if (!business) {
      return res.status(401).json({
        ...invalidMsg,
        loginAttempts: null,
        remainingAttempts: null,
        locked: false
      });
    }

    // 잠금 해제 로직
    if (!business.isActive) {
      const last = business.lastLoginAttempt ? business.lastLoginAttempt.getTime() : 0;
      const passed = Date.now() - last;
      if (passed > LOCKOUT_DURATION_MS) {
        business.isActive = true;
        business.failedLoginAttempts = 0;
        business.lastLoginAttempt = null;
        await business.save();
      }
    }

    // 여전히 잠금 상태면 로그인 불가
    if (!business.isActive) {
      const last = business.lastLoginAttempt ? business.lastLoginAttempt.getTime() : 0;
      const remainMs = Math.max(0, LOCKOUT_DURATION_MS - (Date.now() - last));
      const remainMin = Math.ceil(remainMs / 60000);

      return res.status(423).json({
        message:
          remainMs > 0
            ? `계정이 잠금 상태입니다. 약 ${remainMin}분 후 다시 시도해 주세요.`
            : "계정이 잠금 상태입니다. 관리자에게 문의하세요.",
        locked: true
      });
    }

    // 비밀번호 검증
    const ok =
      typeof business.comparePassword === 'function'
        ? await business.comparePassword(password)
        : await bcrypt.compare(password, business.passwordHash || "");

    // 비밀번호 불일치
    if (!ok) {
      business.failedLoginAttempts += 1;
      business.lastLoginAttempt = new Date();

      // 최대 횟수 초과 계정 잠금
      if (business.failedLoginAttempts >= LOCK_MAX) {
        business.isActive = false;
        await business.save();

        return res.status(423).json({
          message: "유효성 검증 실패로 계정이 잠겼습니다. 관리자에게 문의하세요.",
          loginAttempts: business.failedLoginAttempts,
          remainingAttempts: 0,
          locked: true
        });
      }

      const remaining = Math.max(0, LOCK_MAX - business.failedLoginAttempts);
      await business.save();

      return res.status(400).json({
        ...invalidMsg,
        loginAttempts: business.failedLoginAttempts,
        remainingAttempts: remaining,
        locked: false
      });
    }

    // 로그인 성공: 실패 카운트 초기화 및 토큰 버전 증가 (이전 세션 무효화)
    business.failedLoginAttempts = 0;
    business.lastLoginAttempt = new Date();
    business.tokenVersion = (business.tokenVersion || 0) + 1;
    await business.save();

    // JWT 발급 및 쿠키 설정
    const token = makeToken(business);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 성공 응답
    return res.status(200).json({
      business: business.toSafeJSON(),
      token,
      loginAttempts: 0,
      remainingAttempts: LOCK_MAX,
      locked: false
    });
  } catch (error) {
    return res.status(500).json({
      message: "로그인 실패",
      error: error.message
    });
  }
});

// 인증 필요 라우트
router.use(authenticateToken);

// 내 정보 조회
router.get("/me", async (req, res) => {
  try {
    const me = await Business.findById(req.user.id);

    if (!me) return res.status(404).json({ message: "사업자 정보 없음" });

    return res.status(200).json(me.toSafeJSON());
  } catch (error) {
    res.status(401).json({ message: "조회 실패", error: error.message });
  }
});

// 로그아웃
router.post("/logout", async (req, res) => {
  try {
    // 토큰 버전 증가 (이전 토큰 무효화)
    await Business.findByIdAndUpdate(
      req.user.id,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: '/'
    });

    return res.status(200).json({ message: '로그아웃 성공' });
  } catch (error) {
    return res.status(500).json({ message: '로그아웃 실패', error: error.message });
  }
});

module.exports = router;

