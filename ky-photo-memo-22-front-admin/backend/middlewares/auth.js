// middleware/auth.js
const jwt = require("jsonwebtoken");

exports.authenticateToken = (req, res, next) => {
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
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        console.error("❌ Invalid token:", err.message);
        return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }
};