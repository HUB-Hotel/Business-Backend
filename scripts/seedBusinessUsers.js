require('dotenv').config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { connectDB } = require("../src/config/db");

const BusinessUser = require("../src/auth/model");

// 실제 한국인 이름 목록
const koreanNames = [
  "김민수", "이영희", "박준호", "최지영", "정성호",
  "강수진", "윤태영", "장미영", "임동욱", "한소영",
  "오세훈", "신혜진", "류진우", "조은정", "문성호",
  "송미라", "권혁진", "황지훈", "배수진", "안영수",
  "전혜진", "홍길동", "서민정", "유재석", "노정수",
  "고영수", "남궁민", "도준혁", "라영희", "마동석",
  "백승호", "사미영", "아영수", "자혜진", "차민수",
  "카지영", "타성호", "파수진", "하동욱", "허영수",
  "호미영", "표준호", "피지영", "하성호", "허수진",
  "홍동욱", "황영수", "강미영", "김준호", "이지영"
];



// 이메일 도메인 목록
const emailDomains = [
  "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
  "nate.com", "yahoo.co.kr", "hotmail.com", "outlook.com", "business.com"
];

// 사업자등록번호 생성 함수 (XXX-XX-XXXXX 형식)
function generateBusinessNumber(index) {
  const first = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
  const second = String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
  const third = String(Math.floor(Math.random() * 90000) + 10000).padStart(5, '0');
  return `${first}-${second}-${third}`;
}

// 전화번호 생성 함수 (010-XXXX-XXXX 형식)
function generatePhoneNumber(index) {
  const middle = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
  const last = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
  return `010-${middle}-${last}`;
}

async function seedBusinessUsers() {
  try {
    await connectDB();
    console.log("MongoDB 연결 성공\n");

    // 기존 사업자 데이터 삭제 (선택사항)
    const existingCount = await BusinessUser.countDocuments({ role: 'business' });
    console.log(`기존 사업자 수: ${existingCount}개\n`);

    // 비밀번호 해싱 (모든 사용자가 동일한 비밀번호 사용: "password123")
    const password = "password123";
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, 10);

    const businessUsers = [];
    const usedBusinessNumbers = new Set();
    const usedEmails = new Set();

    for (let i = 0; i < 50; i++) {
      // 고유한 사업자등록번호 생성
      let businessNumber;
      do {
        businessNumber = generateBusinessNumber(i);
      } while (usedBusinessNumbers.has(businessNumber));
      usedBusinessNumbers.add(businessNumber);

      // 고유한 이메일 생성
      let email;
      do {
        // 한국인 이름을 로마자로 변환 (간단한 매핑)
        const nameMap = {
          "김": "kim", "이": "lee", "박": "park", "최": "choi", "정": "jung",
          "강": "kang", "윤": "yoon", "장": "jang", "임": "lim", "한": "han",
          "오": "oh", "신": "shin", "류": "ryu", "조": "cho", "문": "moon",
          "송": "song", "권": "kwon", "황": "hwang", "배": "bae", "안": "an",
          "전": "jeon", "홍": "hong", "서": "seo", "유": "yoo", "노": "noh",
          "고": "go", "남궁": "namgung", "도": "do", "라": "ra", "마": "ma",
          "백": "baek", "사": "sa", "아": "ah", "자": "ja", "차": "cha",
          "카": "ka", "타": "ta", "파": "pa", "하": "ha", "허": "heo",
          "호": "ho", "표": "pyo", "피": "pi"
        };
        
        const lastName = koreanNames[i].substring(0, koreanNames[i].length > 2 ? 2 : 1);
        const lastNameEng = nameMap[lastName] || "user";
        const domain = emailDomains[i % emailDomains.length];
        email = `${lastNameEng}${i + 1}${Math.floor(Math.random() * 100)}@${domain}`;
      } while (usedEmails.has(email));
      usedEmails.add(email);

      const name = koreanNames[i];
      const phoneNumber = generatePhoneNumber(i);

      businessUsers.push({
        name: name,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber,
        passwordHash: passwordHash,
        role: "business",
        isActive: true,
        provider: "local",
        businessNumber: businessNumber,
        failedLoginAttempts: 0
      });
    }

    // 일괄 삽입
    await BusinessUser.insertMany(businessUsers);

    console.log(`✅ 사업자 데이터 ${businessUsers.length}개 생성 완료!\n`);
    console.log("생성된 사업자 목록:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    for (let i = 0; i < businessUsers.length; i++) {
      console.log(`${i + 1}. ${businessUsers[i].name}`);
      console.log(`   이메일: ${businessUsers[i].email}`);
      console.log(`   전화번호: ${businessUsers[i].phoneNumber}`);
      console.log(`   사업자등록번호: ${businessUsers[i].businessNumber}`);
      console.log("");
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 총 ${businessUsers.length}개의 사업자 계정이 생성되었습니다.`);
    console.log(`🔑 모든 계정의 비밀번호: password123`);

    await mongoose.disconnect();
    console.log("\nMongoDB 연결 종료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedBusinessUsers();

