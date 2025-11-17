require('dotenv').config();

const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const mongoose = require("mongoose");


// authRoutes
const authRoutes=require("./routes/authroutes")
const uploadRoutes=require('./routes/upload')
const postRoutes = require('./routes/posts')
const adminRoutes = require('./routes/admin')



const app = express();
const PORT = process.env.PORT||3000


app.use(cors({
  origin: process.env.FRONT_ORIGIN,              // 변경됨: .env 기반 오리진 설정
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'], // 추가됨: 허용 메서드 명시
  allowedHeaders: ['Content-Type', 'Authorization'] // 추가됨: 허용 헤더 명시
}));

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB 연결 성공"))
  .catch((err) => console.error("MongoDB 연결 실패:", err.message));


app.get("/", (_req, res) => res.send("PhotoMemo API OK"));


app.use("/api/auth",authRoutes)
app.use("/api/posts",postRoutes)
app.use("/api/upload",uploadRoutes)
app.use("/api/admin",adminRoutes)



// ── 404
app.use((req, res, next) => {                    // 추가됨: 없는 경로 처리
  res.status(404).json({ message: '요청하신 경로를 찾을 수 없습니다.' });
});

// ── error handler
app.use((err, req, res, next) => {               // 추가됨: 전역 에러 핸들러
  console.error('Unhandled Error:', err);
  res.status(500).json({ message: '서버 오류', error: err?.message || String(err) });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`); // 동일
});