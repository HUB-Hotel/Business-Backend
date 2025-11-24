// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.authenticateToken = async (req, res, next) => {
  let token = null;

  // 1️⃣ Authorization 헤더에서 추출
  const h = req.headers.authorization || '';
  if (h.toLowerCase().startsWith('bearer')) token = h.slice(7).trim();

  // 2️⃣ 쿠키에서 추출
  if (req.cookies?.token) token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: '토큰이 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3️⃣ DB에서 사용자 조회 및 토큰 버전 검증
    const user = await User.findById(decoded.id).select('tokenVersion status role');
    
    if (!user) {
      return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    
    if (user.status === "suspended") {
      return res.status(403).json({ message: '계정이 정지되었습니다.' });
    }
    
    if (user.status === "inactive") {
      return res.status(403).json({ message: '계정이 비활성화되었습니다.' });
    }
    
    // 토큰 버전 검증 (로그아웃 시 버전이 증가하면 이전 토큰 무효화)
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(403).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    
    // DB에서 조회한 사용자 정보를 req.user에 추가
    req.user = {
      ...decoded,
      role: user.role  // DB에서 조회한 role 추가
    };
    next();
  } catch (err) {
    console.error("❌ Invalid token:", err.message);
    return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
  }
};

