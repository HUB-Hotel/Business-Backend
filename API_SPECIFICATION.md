# Business Backend API 명세서

## 기본 정보
- Base URL: `/api/business`
- 인증 방식: Bearer Token (Authorization 헤더) 또는 Cookie 기반 (token 쿠키)
  - Authorization 헤더: `Authorization: Bearer <token>` (우선순위)
  - Cookie: `token` 쿠키
- 응답 형식: JSON

### 공통 응답 형식

**성공 응답:**
```json
{
  "data": {},
  "message": "SUCCESS",
  "resultCode": 200
}
```

**에러 응답:**
```json
{
  "data": null,
  "message": "에러 메시지",
  "resultCode": 400
}
```

---

## 1. 인증 (Auth)

### 1.1 회원가입
- **엔드포인트:** `POST /api/business/auth/signup`
- **인증:** 불필요
- **요청 Body:**
```json
{
  "email": "string (필수)",
  "password": "string (필수)",
  "name": "string (필수)",
  "phoneNumber": "string (필수)",
  "businessName": "string (선택)",
  "businessNumber": "string (필수)"
}
```
- **응답:** 201 Created

### 1.2 로그인
- **엔드포인트:** `POST /api/business/auth/login`
- **인증:** 불필요
- **요청 Body:**
```json
{
  "email": "string (필수)",
  "password": "string (필수)"
}
```
- **응답:** 200 OK
```json
{
  "data": {
    "token": "string (JWT 토큰)",
    "business": {
      "id": "ObjectId",
      "name": "string",
      "email": "string",
      "phoneNumber": "string",
      "businessNumber": "string",
      "createdAt": "Date"
    },
    "message": "string"
  },
  "message": "로그인 성공",
  "resultCode": 200
}
```
- **참고:** 
  - 토큰은 응답 body의 `data.token`에 포함됩니다
  - 동시에 `token` 쿠키에도 설정됩니다
  - 이후 API 호출 시 Authorization 헤더(`Bearer <token>`) 또는 쿠키로 인증 가능

### 1.3 내 정보 조회
- **엔드포인트:** `GET /api/business/auth/me`
- **인증:** 필요 (사업자)
- **응답:** 200 OK
```json
{
  "data": {
    "id": "ObjectId",
    "name": "string",
    "email": "string",
    "phoneNumber": "string",
    "businessName": "string",
    "businessNumber": "string",
    "role": "business" | "admin",
    "isActive": boolean,
    "provider": "local" | "kakao" | "google",
    "createdAt": "Date",
    "updatedAt": "Date"
  }
}
```

### 1.4 로그아웃
- **엔드포인트:** `POST /api/business/auth/logout`
- **인증:** 필요 (사업자)
- **응답:** 200 OK (token 쿠키 삭제)

### 1.5 비밀번호 변경
- **엔드포인트:** `PUT /api/business/auth/password`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "currentPassword": "string (필수)",
  "newPassword": "string (필수, 최소 6자)"
}
```

### 1.6 비밀번호 찾기
- **엔드포인트:** `POST /api/business/auth/forgot-password`
- **인증:** 불필요
- **요청 Body:**
```json
{
  "email": "string (필수)"
}
```

### 1.7 프로필 수정
- **엔드포인트:** `PUT /api/business/auth/profile`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "name": "string (선택)",
  "phoneNumber": "string (선택)",
  "businessNumber": "string (선택)"
}
```

### 1.8 카카오 로그인
- **엔드포인트:** `POST /api/business/auth/kakao`
- **인증:** 불필요
- **요청 Body:**
```json
{
  "access_token": "string (필수)" 또는 "accessToken": "string (필수)"
}
```
- **참고:** `access_token` 또는 `accessToken` 둘 다 지원

### 1.9 카카오 회원가입 완료
- **엔드포인트:** `POST /api/business/auth/kakao/complete`
- **인증:** 불필요
- **요청 Body:** (구현 필요)

---

## 2. 호텔/숙소 (Lodging)

### 2.1 숙소 목록 조회
- **엔드포인트:** `GET /api/business/hotel`
- **인증:** 필요 (사업자)
- **응답:** 200 OK
```json
{
  "data": [
    {
      "_id": "ObjectId",
      "lodgingName": "string",
      "address": "string",
      "rating": "number (1-5)",
      "reviewCount": "number",
      "minPrice": "number",
      "lat": "number",
      "lng": "number",
      "description": "string",
      "images": ["string"],
      "country": "string",
      "categoryId": "ObjectId",
      "category": {
        "id": "ObjectId",
        "name": "string",
        "code": "string",
        "description": "string"
      },
      "hashtag": ["string"],
      "phoneNumber": "string",
      "email": "string",
      "website": "string",
      "checkInTime": "string (예: 15:00)",
      "checkOutTime": "string (예: 11:00)",
      "city": "string",
      "businessId": "ObjectId",
      "businessName": "string",
      "amenityId": "ObjectId",
      "createdAt": "Date",
      "updatedAt": "Date"
    }
  ]
}
```

### 2.2 숙소 상세 조회
- **엔드포인트:** `GET /api/business/hotel/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

### 2.3 숙소 생성
- **엔드포인트:** `POST /api/business/hotel` 또는 `PUT /api/business/hotel`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "lodgingName": "string (필수, 최대 50자)",
  "address": "string (필수, 최대 255자)",
  "rating": "number (필수, 1-5)",
  "description": "string (필수)",
  "images": ["string"] (필수, 최소 1개),
  "country": "string (필수, 최대 50자)",
  "categoryId": "ObjectId (필수)",
  "hashtag": ["string"] (선택),
  "bbqGrill": "boolean (선택)",
  "netflix": "boolean (선택)",
  "swimmingPool": "boolean (선택)",
  "parking": "boolean (선택)",
  "wifi": "boolean (선택)",
  "kitchen": "boolean (선택)",
  "pc": "boolean (선택)",
  "tv": "boolean (선택)",
  "ac": "boolean (선택)",
  "minPrice": "number (선택, >= 0)",
  "lat": "number (선택, -90 ~ 90)",
  "lng": "number (선택, -180 ~ 180)",
  "phoneNumber": "string (선택)",
  "email": "string (선택)",
  "website": "string (선택)",
  "checkInTime": "string (선택, 예: 15:00)",
  "checkOutTime": "string (선택, 예: 11:00)",
  "city": "string (선택)",
  "policies": "string (선택)",
  "amenities": "object (선택)"
}
```
- **참고:** POST와 PUT 모두 지원 (프론트 호환성)

### 2.4 숙소 수정
- **엔드포인트:** `PUT /api/business/hotel/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:** (생성과 동일, 모든 필드 선택)

### 2.5 숙소 삭제
- **엔드포인트:** `DELETE /api/business/hotel/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **참고:** 예약이 있으면 삭제 불가

### 2.6 호텔 이미지 수정
- **엔드포인트:** `PUT /api/business/hotel/images`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "images": ["string"] (필수, 배열)
}
```

---

## 3. 객실 (Room)

### 3.1 객실 목록 조회
- **엔드포인트:** `GET /api/business/rooms`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `lodgingId`: ObjectId (선택)
  - `status`: "active" | "inactive" | "maintenance" (선택)
  - `search`: string (선택)
  - `page`: number (선택, 기본값: 1)
  - `pageSize`: number (선택, 기본값: 10)

### 3.2 객실 상세 조회
- **엔드포인트:** `GET /api/business/rooms/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

### 3.3 객실 생성
- **엔드포인트:** `POST /api/business/rooms`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "lodgingId": "ObjectId (필수)",
  "price": "number (필수, >= 0)",
  "quantity": "number (선택)" 또는 "countRoom": "number (필수, >= 1)",
  "checkInTime": "string (선택, 예: 15:00)",
  "checkOutTime": "string (선택, 예: 11:00)",
  "name": "string (선택)" 또는 "roomName": "string (필수, 최대 100자)",
  "type": "standard" | "deluxe" | "suite" (선택, 기본값: standard),
  "roomSize": "string (필수, 최대 50자)",
  "maxGuests": "number (선택)" 또는 "capacityMax": "number (필수, >= 1)",
  "capacityMin": "number (필수, >= 1)",
  "ownerDiscount": "number (선택, 0-100)",
  "platformDiscount": "number (선택, 0-100)",
  "images": ["string"] (선택) 또는 "roomImage": "string (선택)",
  "amenities": ["string"] (선택),
  "description": "string (선택)",
  "status": "active" | "inactive" | "maintenance" (선택, 기본값: active)
}
```
- **참고:** 필드명 호환성
  - `name` ↔ `roomName` (둘 다 지원)
  - `maxGuests` ↔ `capacityMax` (둘 다 지원)
  - `quantity` ↔ `countRoom` (둘 다 지원)
  - `images` ↔ `roomImage` (둘 다 지원)

### 3.4 객실 수정
- **엔드포인트:** `PUT /api/business/rooms/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:** (생성과 동일, 모든 필드 선택)

### 3.5 객실 삭제
- **엔드포인트:** `DELETE /api/business/rooms/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **참고:** 예약이 있으면 삭제 불가

### 3.6 객실 상태 변경
- **엔드포인트:** `PATCH /api/business/rooms/:id/status`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "status": "available" | "unavailable" | "maintenance" | "active" | "inactive"
}
```
- **참고:** 프론트는 `available`/`unavailable`을 보내지만, 백엔드는 `active`/`inactive`로 저장
  - `available` → `active`
  - `unavailable` → `inactive`
  - `maintenance` → `maintenance` (동일)

---

## 4. 예약 (Booking)

### 4.1 예약 생성
- **엔드포인트:** `POST /api/business/bookings`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "roomId": "ObjectId (필수)" 또는 "room_id": "ObjectId (필수)",
  "checkIn": "Date (필수)" 또는 "checkin_date": "Date (필수)",
  "checkOut": "Date (필수)" 또는 "checkout_date": "Date (필수)",
  "adult": "number (선택, 기본값: 0, >= 0)",
  "child": "number (선택, 기본값: 0, >= 0)"
}
```
- **참고:** 필드명 호환성
  - `roomId` ↔ `room_id` (둘 다 지원)
  - `checkIn` ↔ `checkin_date` (둘 다 지원)
  - `checkOut` ↔ `checkout_date` (둘 다 지원)
- **응답:** 201 Created

### 4.2 예약 목록 조회
- **엔드포인트:** `GET /api/business/bookings`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `status`: "pending" | "confirmed" | "cancelled" | "completed" (선택)
  - `lodgingId`: ObjectId (선택)
  - `startDate`: Date (선택)
  - `endDate`: Date (선택)
  - `search`: string (선택)
  - `page`: number (선택, 기본값: 1)
  - `pageSize`: number (선택, 기본값: 10) 또는 `limit`: number

### 4.3 예약 상세 조회
- **엔드포인트:** `GET /api/business/bookings/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

### 4.4 예약 상태 변경
- **엔드포인트:** `PATCH /api/business/bookings/:id/status`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "status": "pending" | "confirmed" | "cancelled" | "completed" (필수),
  "cancellationReason": "string (선택, 취소 시)"
}
```

### 4.5 결제 상태 변경
- **엔드포인트:** `PATCH /api/business/bookings/:id/payment`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "paymentStatus": "pending" | "paid" | "refunded" | "failed" (필수)
}
```

### 4.6 예약 통계
- **엔드포인트:** `GET /api/business/bookings/stats`
- **인증:** 필요 (사업자)
- **응답:** 대시보드 통계와 동일

---

## 5. 리뷰 (Review)

### 5.1 숙소별 리뷰 목록 조회 (공개)
- **엔드포인트:** `GET /api/business/reviews/lodging/:lodgingId`
- **인증:** 불필요
- **Path Parameters:**
  - `lodgingId`: ObjectId (필수)
- **Query Parameters:**
  - `page`: number (선택)
  - `limit`: number (선택)
  - `rating`: number (선택, 1-5)

### 5.2 사업자의 모든 숙소 리뷰 목록 조회
- **엔드포인트:** `GET /api/business/reviews`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `page`: number (선택, 기본값: 1)
  - `pageSize`: number (선택, 기본값: 10) 또는 `limit`: number
  - `status`: "active" | "blocked" (선택)
    - **참고:** 프론트는 `approved`/`pending`/`reported`를 보낼 수 있지만, 백엔드에서 매핑:
      - `approved` → `active`
      - `pending` → `active`
      - `reported` → `blocked`
  - `rating`: number (선택, 1-5)
  - `search`: string (선택)

### 5.3 리뷰 상세 조회
- **엔드포인트:** `GET /api/business/reviews/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

### 5.4 리뷰 답변
- **엔드포인트:** `POST /api/business/reviews/:id/reply`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "reply": "string (필수, 최대 2000자)"
}
```

### 5.5 리뷰 신고
- **엔드포인트:** `POST /api/business/reviews/:id/report`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "reason": "string (필수)"
}
```

### 5.6 리뷰 차단
- **엔드포인트:** `PATCH /api/business/reviews/:id/block`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

### 5.7 차단된 리뷰 목록 조회
- **엔드포인트:** `GET /api/business/reviews/blocked`
- **인증:** 필요 (사업자)

### 5.8 신고 내역 조회
- **엔드포인트:** `GET /api/business/reviews/reports`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `status`: string (선택)
  - `page`: number (선택, 기본값: 1)
  - `pageSize`: number (선택, 기본값: 10) 또는 `limit`: number

### 5.9 리뷰 통계
- **엔드포인트:** `GET /api/business/reviews/stats`
- **인증:** 필요 (사업자)

---

## 6. 편의시설 (Amenity)

### 6.1 편의시설 생성/수정
- **엔드포인트:** `POST /api/business/amenities`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "lodging_id": "ObjectId (필수)",
  "bbqGrill": "boolean (선택, 기본값: false)",
  "netflix": "boolean (선택, 기본값: false)",
  "swimmingPool": "boolean (선택, 기본값: false)",
  "parking": "boolean (선택, 기본값: false)",
  "wifi": "boolean (선택, 기본값: false)",
  "kitchen": "boolean (선택, 기본값: false)",
  "pc": "boolean (선택, 기본값: false)",
  "tv": "boolean (선택, 기본값: false)",
  "ac": "boolean (선택, 기본값: false)"
}
```

### 6.2 숙소별 편의시설 조회
- **엔드포인트:** `GET /api/business/amenities/lodging/:lodgingId`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `lodgingId`: ObjectId (필수)

### 6.3 편의시설 수정
- **엔드포인트:** `PUT /api/business/amenities/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:** (생성과 동일, lodging_id 제외)

---

## 7. 공지사항 (Notice)

### 7.1 공지사항 생성/수정
- **엔드포인트:** `POST /api/business/notices`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "room_id": "ObjectId (필수)",
  "content": "string (선택, 최대 100자)",
  "usage_guide": "string (선택, 최대 100자)",
  "introduction": "string (선택, 최대 100자)"
}
```
- **참고:** 모델 필드명은 `usageGuide`이지만 API는 `usage_guide` 사용

### 7.2 객실별 공지사항 조회
- **엔드포인트:** `GET /api/business/notices/room/:roomId`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `roomId`: ObjectId (필수)

### 7.3 공지사항 수정
- **엔드포인트:** `PUT /api/business/notices/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)
- **요청 Body:**
```json
{
  "content": "string (선택)",
  "usage_guide": "string (선택)",
  "introduction": "string (선택)"
}
```

---

## 8. 사진 (Picture)

### 8.1 객실별 사진 목록 조회
- **엔드포인트:** `GET /api/business/pictures/room/:roomId`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `roomId`: ObjectId (필수)

### 8.2 사진 추가
- **엔드포인트:** `POST /api/business/pictures`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "room_id": "ObjectId (필수)",
  "picture_name": "string (필수, 최대 100자)",
  "picture_url": "string (필수, 최대 200자)"
}
```

### 8.3 사진 삭제
- **엔드포인트:** `DELETE /api/business/pictures/:id`
- **인증:** 필요 (사업자)
- **Path Parameters:**
  - `id`: ObjectId (필수)

---

## 9. 업로드 (Upload)

### 9.1 Presign URL 생성
- **엔드포인트:** `POST /api/business/upload/presign`
- **인증:** 필요 (사업자)
- **요청 Body:**
```json
{
  "filename": "string (필수)",
  "contentType": "string (필수)"
}
```

### 9.2 Ping
- **엔드포인트:** `GET /api/business/upload/ping`
- **인증:** 불필요
- **응답:** 200 OK

---

## 10. 통계 (Stats)

### 10.1 대시보드 통계
- **엔드포인트:** `GET /api/business/stats/dashboard`
- **인증:** 필요 (사업자)
- **응답:** 200 OK
```json
{
  "data": {
    "hotel": {
      "todayBookings": "number (필수, 오늘 생성된 예약 수)",
      "totalRevenue": "number (필수, 전체 누적 매출)",
      "totalRooms": "number (필수, 전체 객실 수)",
      "activeRooms": "number (선택, 현재 체크인된 예약 수)",
      "newMembers": "number (필수, 이번 달 신규 회원 수)",
      "newUsers": "number (선택, newMembers와 동일)",
      "today": {
        "bookings": "number (선택, todayBookings와 동일)",
        "revenue": "number (선택, 오늘의 매출)"
      }
    },
    "chartData": {
      "labels": ["string"] (필수, 최소 1개, 예: ["1월", "2월", "3월", "4월", "5월", "6월"]),
      "revenue": ["number"] (필수, labels와 같은 길이, 월별 매출),
      "bookings": ["number"] (필수, labels와 같은 길이, 월별 예약 수)
    },
    "recentBookings": [
      {
        "_id": "ObjectId (필수)",
        "id": "string (선택, _id를 문자열로 변환)",
        "bookingNumber": "string (선택)",
        "lodgingName": "string (필수)",
        "hotelName": "string (선택, lodgingName과 동일)",
        "guest": {
          "name": "string (필수)"
        },
        "guestName": "string (선택, guest.name과 동일)",
        "user": {
          "name": "string (선택, guest.name과 동일)"
        },
        "status": "string (필수, pending|confirmed|cancelled|completed)"
      }
    ]
  },
  "message": "SUCCESS",
  "resultCode": 200
}
```

### 10.2 통계 조회 (쿼리 파라미터 기반)
- **엔드포인트:** `GET /api/business/stats`
- **인증:** 필요 (사업자)
- **Query Parameters:** (구현 확인 필요)

### 10.3 매출 통계
- **엔드포인트:** `GET /api/business/stats/revenue`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `period`: "month" | "year" (선택, 기본값: "month")

### 10.4 예약 통계
- **엔드포인트:** `GET /api/business/stats/bookings`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `period`: "month" | "year" (선택, 기본값: "month")

### 10.5 점유율 통계
- **엔드포인트:** `GET /api/business/stats/occupancy`
- **인증:** 필요 (사업자)
- **Query Parameters:**
  - `period`: "month" | "year" (선택, 기본값: "month")

---

## 주요 필드명 불일치 및 호환성

### 1. 객실 (Room)
- `name` ↔ `roomName` (둘 다 지원, 자동 동기화)
- `maxGuests` ↔ `capacityMax` (둘 다 지원, 자동 동기화)
- `quantity` ↔ `countRoom` (둘 다 지원, 자동 동기화)
- `images` ↔ `roomImage` (둘 다 지원, 자동 동기화)

### 2. 예약 (Booking)
- `roomId` ↔ `room_id` (둘 다 지원)
- `checkIn` ↔ `checkin_date` (둘 다 지원)
- `checkOut` ↔ `checkout_date` (둘 다 지원)

### 3. 객실 상태
- 프론트: `available`/`unavailable`/`maintenance`
- 백엔드 저장: `active`/`inactive`/`maintenance`
- 매핑: `available` → `active`, `unavailable` → `inactive`

### 4. 리뷰 상태
- 프론트: `approved`/`pending`/`reported`
- 백엔드: `active`/`blocked`
- 매핑: `approved`/`pending` → `active`, `reported` → `blocked`

### 5. 공지사항 필드명
- API 요청: `usage_guide` (스네이크 케이스)
- 모델 필드: `usageGuide` (카멜 케이스)
- 백엔드에서 자동 변환 처리

### 6. 카카오 로그인
- `access_token` ↔ `accessToken` (둘 다 지원)

---

## 에러 코드

### HTTP 상태 코드
- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `409`: 충돌 (예: 예약 불가능)
- `423`: 계정 잠금
- `500`: 서버 오류
- `501`: 미구현 기능

### 에러 메시지 예시
- `"이메일/비밀번호/이름/전화번호는 필수입니다."`
- `"사업자 정보를 찾을 수 없습니다."`
- `"숙소를 찾을 수 없습니다."`
- `"객실을 찾을 수 없습니다."`
- `"예약을 찾을 수 없습니다."`
- `"권한이 없습니다."`
- `"예약이 있어 삭제할 수 없습니다."`

---

## 인증 미들웨어

모든 `/api/business/*` 엔드포인트는 기본적으로 인증이 필요합니다. (단, 명시적으로 "인증 불필요"로 표시된 엔드포인트 제외)

### 인증 토큰 전달 방법

**방법 1: Authorization 헤더 (권장)**
```
Authorization: Bearer <your-jwt-token>
```

**방법 2: Cookie**
```
Cookie: token=<your-jwt-token>
```

**우선순위:** Authorization 헤더가 쿠키보다 우선합니다. Authorization 헤더에 토큰이 있으면 쿠키는 무시됩니다.

### 권한 체크
- 사업자 권한이 필요한 엔드포인트는 `requireBusiness` 미들웨어를 사용합니다.
- 관리자 권한이 필요한 엔드포인트는 `requireAdmin` 미들웨어를 사용합니다.

---

## 날짜 형식

- 날짜는 ISO 8601 형식 또는 JavaScript Date 객체로 전달됩니다.
- 예: `"2024-01-15T00:00:00.000Z"` 또는 `"2024-01-15"`

---

## 페이지네이션

- `page`: 페이지 번호 (1부터 시작)
- `pageSize` 또는 `limit`: 페이지당 항목 수
- 기본값: `page=1`, `pageSize=10`

---

## 주의사항

1. **ObjectId 형식**: 모든 ID는 MongoDB ObjectId 형식이어야 합니다.
2. **필수 필드**: 필수 필드가 누락되면 400 에러가 반환됩니다.
3. **권한 검증**: 사업자는 자신의 리소스만 접근할 수 있습니다.
4. **삭제 제약**: 예약이 있는 숙소/객실은 삭제할 수 없습니다.
5. **필드명 호환성**: 일부 필드는 여러 이름을 지원하지만, 일관성을 위해 권장 필드명 사용을 권장합니다.

