# 데이터 모델 마이그레이션 가이드

## 📋 개요

기존의 Business 단일 모델 구조에서 **User 모델 + Business 모델**의 이원 구조로 변경되었습니다.
이를 통해 권한에 따라 USER, BUSINESS, ADMIN을 구분하고 더 유연한 사용자 관리가 가능해졌습니다.

---

## 🔄 주요 변경사항

### 1. 새로운 User 모델 (`User.js`)

**필드 구조:**
```javascript
{
  user_id (PK),
  user_name,           // 사용자 이름
  email,              // 로그인용 이메일 (unique)
  phone,              // 전화번호
  password,           // 해시된 비밀번호
  date_of_birth,      // 생년월일
  profile_image,      // 프로필 이미지 URL
  address,            // 주소
  role,               // USER / BUSINESS / ADMIN
  status,             // active / inactive / suspended / pending
  payment_method,     // credit_card / debit_card / bank_transfer / none
  failedLoginAttempts,
  lastLoginAttempt,
  tokenVersion,
  created_on (timestamp),
  updated_on (timestamp)
}
```

**특징:**
- 모든 사용자(일반사용자, 사업자, 관리자)의 통합 관리
- 권한별 로그인 로직 (사업자는 승인 대기 중 로그인 불가)
- 비밀번호 메서드: `comparePassword()`, `setPassword()`

---

### 2. 축소된 Business 모델 (`Business.js`)

**기존 구조 (복잡함):**
```
email, passwordHash, businessName, ownerName, phone, businessNumber,
mailOrderNumber, businessType, zipCode, address, addressDetail,
status, approvedAt, rejectedAt, verification {...}
```

**새로운 구조 (간결함):**
```javascript
{
  business_id (PK),
  login_id (FK → Users.user_id),  // 사업자 계정 참조
  business_name,                   // 상호명
  business_number,                 // 사업자등록번호 (unique)
  created_at (timestamp),
  updated_at (timestamp)
}
```

**특징:**
- User 모델과 1:1 매핑 (FK: login_id)
- 사용자 정보는 User 모델에서 관리
- 사업자 승인/검수 상태는 User.status에서 관리

---

## 🔐 권한 체계

### User.role 값

| 역할 | 설명 | 로그인 가능 | 호텔 관리 |
|------|------|----------|---------|
| `USER` | 일반 사용자 | ✅ | ❌ |
| `BUSINESS` | 사업자 | ✅* | ✅ |
| `ADMIN` | 관리자 | ✅ | ✅ |

*BUSINESS 사용자가 status='pending' 상태면 로그인 불가

### User.status 값

| 상태 | 설명 |
|------|------|
| `active` | 정상 사용 가능 |
| `inactive` | 비활성 (로그인 불가) |
| `suspended` | 정지됨 (로그인 불가) |
| `pending` | 승인 대기 중 (BUSINESS만 해당) |

---

## 🔄 API 변경사항

### 회원가입 (`POST /api/auth/register`)

**요청 본문 (USER 등록):**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "user_name": "홍길동",
  "phone": "010-1234-5678",
  "date_of_birth": "1990-01-01",
  "address": "서울시 강남구",
  "profile_image": "https://...",
  "role": "USER"
}
```

**요청 본문 (BUSINESS 등록):**
```json
{
  "email": "business@example.com",
  "password": "password123",
  "user_name": "김사업가",
  "phone": "010-9876-5432",
  "role": "BUSINESS",
  "business_name": "호텔 한글",
  "business_number": "123-45-67890"
}
```

**응답:**
```json
{
  "user": {
    "user_id": "...",
    "email": "...",
    "user_name": "...",
    "role": "USER/BUSINESS",
    "status": "active/pending"
  },
  "message": "회원가입 완료"
}
```

### 로그인 (`POST /api/auth/login`)

**요청 본문:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "user": { /* User 객체 */ },
  "token": "eyJhbGc...",
  "loginAttempts": 0,
  "remainingAttempts": 5,
  "locked": false
}
```

### 내 정보 조회 (`GET /api/auth/me`)

**응답 (USER):**
```json
{
  "user_id": "...",
  "email": "...",
  "user_name": "...",
  "role": "USER",
  "status": "active"
}
```

**응답 (BUSINESS):**
```json
{
  "user_id": "...",
  "email": "...",
  "user_name": "...",
  "role": "BUSINESS",
  "status": "active",
  "business": {
    "business_id": "...",
    "business_name": "호텔 한글",
    "business_number": "123-45-67890"
  }
}
```

---

## 🔧 라우트 수정 사항

모든 사업자 관련 라우트(`hotels`, `rooms`, `reservations`, `stats`, 등)에서
User ID → Business ID 변환 로직이 추가되었습니다.

### 예시

**Before:**
```javascript
const businessId = req.user.id;
const hotels = await Hotel.find({ business: businessId });
```

**After:**
```javascript
const business = await Business.findOne({ login_id: req.user.id });
if (!business) {
  return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
}
const hotels = await Hotel.find({ business: business._id });
```

### 수정된 라우트 파일

- ✅ `routes/auth.js` - 회원가입, 로그인 로직 완전 변경
- ✅ `routes/hotels.js` - 모든 라우트에서 User→Business 변환
- ✅ `routes/rooms.js` - 모든 라우트에서 User→Business 변환
- ✅ `routes/reservations.js` - 모든 라우트에서 User→Business 변환
- ✅ `routes/stats.js` - 모든 라우트에서 User→Business 변환
- ✅ `routes/facilities.js` - 호텔 소유권 확인 시 Business 참조
- ✅ `routes/notices.js` - 호텔 소유권 확인 시 Business 참조
- ✅ `routes/pictures.js` - 호텔 소유권 확인 시 Business 참조

### 수정된 미들웨어

- ✅ `middlewares/auth.js` - User 모델 참조로 토큰 검증
- ✅ `middlewares/roles.js` - role 확인 로직 업데이트 (대문자 사용)

---

## 📊 데이터 마이그레이션 스크립트 (선택사항)

기존 데이터가 있는 경우, 다음과 같이 마이그레이션할 수 있습니다:

```javascript
// migrate.js
const Business = require('./models/Business');
const User = require('./models/User');
const mongoose = require('mongoose');

async function migrate() {
  try {
    // 기존 Business 컬렉션의 모든 문서 조회
    const oldBusinesses = await Business.find({});
    
    for (const oldBiz of oldBusinesses) {
      // User 생성
      const user = await User.create({
        email: oldBiz.email,
        password: oldBiz.passwordHash,
        user_name: oldBiz.ownerName || oldBiz.businessName,
        phone: oldBiz.phone,
        address: oldBiz.address,
        role: 'BUSINESS',
        status: oldBiz.status === 'approved' ? 'active' : 'pending'
      });
      
      // 새로운 Business 생성
      await Business.create({
        login_id: user._id,
        business_name: oldBiz.businessName,
        business_number: oldBiz.businessNumber
      });
    }
    
    console.log('마이그레이션 완료');
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  }
}

migrate();
```

---

## ✅ 테스트 체크리스트

- [ ] USER 회원가입 및 로그인 테스트
- [ ] BUSINESS 회원가입 및 로그인 테스트 (미승인 상태)
- [ ] BUSINESS 승인 후 로그인 테스트
- [ ] /api/auth/me 조회 테스트 (USER vs BUSINESS)
- [ ] 호텔 생성/수정/삭제 (BUSINESS만)
- [ ] 방 관리 라우트 테스트
- [ ] 예약 목록 조회 및 필터링
- [ ] 대시보드 통계 조회
- [ ] 비인가 사용자 접근 제어

---

## 🚀 배포 체크리스트

1. MongoDB에서 기존 Business 컬렉션 백업
2. User 모델 생성
3. Business 모델 필드 축소 및 login_id 필드 추가
4. 데이터 마이그레이션 실행 (필요시)
5. 모든 라우트 테스트
6. 프로덕션 배포

---

## 📞 문제 해결

**Q: 기존 사업자 계정이 로그인 안 됨**
- A: Business 모델에서 User 모델로 마이그레이션 필요

**Q: "사업자 정보를 찾을 수 없습니다" 에러**
- A: User.role = 'BUSINESS'인 경우, Business 문서에 login_id가 정확히 매핑되었는지 확인

**Q: role 값이 'business'인데 권한 에러 발생**
- A: 새로운 시스템에서는 대문자 'BUSINESS' 사용 (기존은 소문자 'business')

---

## 🔗 관련 문서

- User 모델: `models/User.js`
- Business 모델: `models/Business.js`
- 인증 라우트: `routes/auth.js`
- 미들웨어: `middlewares/auth.js`, `middlewares/roles.js`

