require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { addressToCoordinates } = require('../src/common/kakaoMap');

// 모델 import
const User = require('../src/auth/model');
const Business = require('../src/auth/business');
const Amenity = require('../src/amenity/model');
const Lodging = require('../src/lodging/model');
const Room = require('../src/room/model');
const Booking = require('../src/booking/model');
const Review = require('../src/review/model');

// 헬퍼 함수: duration 계산
const calculateDuration = (checkinDate, checkoutDate) => {
  return Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
};

// 헬퍼 함수: 주소에서 category 추론
const inferCategory = (address, name) => {
  if (name.includes('리조트') || address.includes('리조트')) {
    return '리조트';
  }
  if (name.includes('모텔') || address.includes('모텔')) {
    return '모텔';
  }
  if (name.includes('게스트하우스') || address.includes('게스트하우스')) {
    return '게스트하우스';
  }
  if (name.includes('에어비앤비') || address.includes('에어비앤비')) {
    return '에어비앤비';
  }
  return '호텔'; // 기본값
};

// 메인 함수
const seedDatabase = async () => {
  try {
    console.log('🔄 MongoDB 연결 중...');
    await connectDB();

    // 기존 데이터 삭제 (참조 관계를 고려하여 역순으로 삭제)
    console.log('🗑️  기존 데이터 삭제 중...');
    
    // 1. Review 삭제 (가장 하위 참조)
    await Review.deleteMany({});
    console.log('  ✓ Review 삭제 완료');
    
    // 2. Booking 삭제
    await Booking.deleteMany({});
    console.log('  ✓ Booking 삭제 완료');
    
    // 3. Room 삭제
    await Room.deleteMany({});
    console.log('  ✓ Room 삭제 완료');
    
    // 4. Lodging 삭제
    await Lodging.deleteMany({});
    console.log('  ✓ Lodging 삭제 완료');
    
    // 5. Amenity 삭제
    await Amenity.deleteMany({});
    console.log('  ✓ Amenity 삭제 완료');
    
    // 6. Business 삭제 (Lodging이 이미 삭제되었으므로 안전)
    // 먼저 모든 Business 삭제 (null 포함)
    let deletedBusinesses = await Business.deleteMany({});
    console.log(`  ✓ Business 삭제 완료 (${deletedBusinesses.deletedCount}개)`);
    
    // loginId가 null인 Business도 별도로 삭제 (혹시 모를 경우 대비)
    deletedBusinesses = await Business.deleteMany({ loginId: null });
    if (deletedBusinesses.deletedCount > 0) {
      console.log(`  ✓ null loginId Business 추가 삭제 (${deletedBusinesses.deletedCount}개)`);
    }
    
    // 7. BUSINESS 역할 User 삭제
    const deletedUsers = await User.deleteMany({ role: 'BUSINESS' });
    console.log(`  ✓ BUSINESS User 삭제 완료 (${deletedUsers.deletedCount}명)`);
    
    // 8. 일반 USER 삭제 (seed 스크립트로 생성된 것들)
    // 기존 운영 데이터와 충돌을 피하기 위해 특정 패턴의 이메일만 삭제하거나
    // 또는 모든 USER를 삭제 (테스트 환경 가정)
    await User.deleteMany({ role: 'USER' });
    console.log('  ✓ USER 삭제 완료');
    
    console.log('✅ 기존 데이터 삭제 완료\n');

    // ===== 1. Business 데이터 정의 =====
    console.log('👤 사업자 데이터 준비 중...');
    
    // Business 생성 전에 한 번 더 완전히 정리 (null 포함)
    await Business.deleteMany({});
    const nullBusinesses = await Business.deleteMany({ loginId: null });
    if (nullBusinesses.deletedCount > 0) {
      console.log(`  ⚠️  추가로 null loginId Business ${nullBusinesses.deletedCount}개 삭제`);
    }
    
    const businessData = [
      {
        businessName: 'Lotte Hotels & Resorts',
        businessNumber: '120-88-00777',
        email: 'lotte@business.com',
        name: '롯데 호텔 관리자',
        phoneNumber: '010-1000-0001'
      },
      {
        businessName: 'Shilla Hotels & Resorts',
        businessNumber: '104-81-17709',
        email: 'shilla@business.com',
        name: '신라 호텔 관리자',
        phoneNumber: '010-1000-0002'
      }
    ];

    const businesses = [];
    
    // 각 사업자별로 User와 Business 생성
    for (const data of businessData) {
      // BUSINESS 역할 사용자 생성
      let businessUser = await User.findOne({ email: data.email });
      
      if (!businessUser) {
        businessUser = new User({
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: 'BUSINESS',
          isActive: true
        });
        await businessUser.setPassword('password123');
        await businessUser.save();
        console.log(`✅ ${data.businessName} BUSINESS 사용자 생성 완료`);
      }

      // Business 정보 생성
      // 먼저 해당 businessUser와 관련된 모든 Business 삭제
      await Business.deleteMany({ loginId: businessUser._id });
      await Business.deleteMany({ businessNumber: data.businessNumber });
      
      // loginId가 null인 모든 Business 삭제 (unique 인덱스 충돌 방지)
      const nullDeleted = await Business.deleteMany({ loginId: null });
      if (nullDeleted.deletedCount > 0) {
        console.log(`  ⚠️  ${data.businessName} - null loginId Business ${nullDeleted.deletedCount}개 삭제`);
      }
      
      let business = await Business.findOne({ loginId: businessUser._id });
      if (!business) {
        
        try {
          business = await Business.create({
            loginId: businessUser._id,
            businessName: data.businessName,
            businessNumber: data.businessNumber
          });
          console.log(`✅ ${data.businessName} Business 정보 생성 완료`);
        } catch (error) {
          if (error.code === 11000) {
            // 중복 키 에러 발생 시, 더 강력하게 정리 후 재생성
            console.warn(`⚠️  ${data.businessName} Business 중복 감지, 기존 데이터 정리 후 재생성`);
            
            // 모든 가능한 중복 제거
            await Business.deleteMany({ 
              $or: [
                { loginId: null },
                { loginId: businessUser._id },
                { businessNumber: data.businessNumber }
              ]
            });
            
            // 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 100));
            
            business = await Business.create({
              loginId: businessUser._id,
              businessName: data.businessName,
              businessNumber: data.businessNumber
            });
            console.log(`✅ ${data.businessName} Business 정보 재생성 완료`);
          } else {
            throw error;
          }
        }
      } else {
        // 기존 Business가 있으면 사업자명 업데이트
        business.businessName = data.businessName;
        await business.save();
      }
      
      businesses.push({ business, businessUser });
    }

    // ===== 2. Lodging 데이터 정의 =====
    const lodgingData = [
      {
        businessIndex: 0, // Lotte Hotels & Resorts
        lodgingName: '롯데호텔 서울',
        address: '서울특별시 중구 을지로 30',
        description: '서울 중심부 명동에 위치한 5성급 호텔',
        rating: 4.5,
        reviewCount: 120,
        minPrice: 250000,
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        amenities: ['무료 WiFi', '수영장', '피트니스', '레스토랑', '주차장'],
        hashtag: ['럭셔리', '비즈니스'],
        category: '호텔',
        country: '대한민국'
      },
      {
        businessIndex: 0, // Lotte Hotels & Resorts
        lodgingName: '롯데호텔 부산',
        address: '부산광역시 해운대구 해운대해변로 296',
        description: '해운대 해변이 한눈에 보이는 오션뷰 호텔',
        rating: 4.3,
        reviewCount: 85,
        minPrice: 180000,
        images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'],
        amenities: ['무료 WiFi', '오션뷰', '조식 포함', '주차장'],
        hashtag: ['오션뷰', '가족여행'],
        category: '호텔',
        country: '대한민국'
      },
      {
        businessIndex: 1, // Shilla Hotels & Resorts
        lodgingName: '신라호텔 제주',
        address: '제주특별자치도 서귀포시 중문관광로 72번길 75',
        description: '제주 중문 리조트에 위치한 럭셔리 호텔',
        rating: 4.7,
        reviewCount: 200,
        minPrice: 320000,
        images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'],
        amenities: ['무료 WiFi', '스파', '골프장', '해변 접근', '키즈클럽'],
        hashtag: ['럭셔리', '리조트', '신혼여행'],
        category: '리조트',
        country: '대한민국'
      }
    ];

    // ===== 3. Lodging 데이터 삽입 (좌표 변환 포함) =====
    console.log('🏨 숙소 데이터 삽입 중...');
    const lodgings = [];

    for (const data of lodgingData) {
      try {
        if (!businesses[data.businessIndex]) {
          console.error(`❌ ${data.lodgingName}: Business 인덱스 ${data.businessIndex}가 없습니다.`);
          continue;
        }

        const business = businesses[data.businessIndex].business;
        const businessId = business._id;

        // 주소를 좌표로 변환
        let coordinates;
        try {
          coordinates = await addressToCoordinates(data.address);
        } catch (error) {
          console.warn(`⚠️  좌표 변환 실패 (${data.lodgingName}): ${error.message}. 대략적 좌표 사용`);
          // 서울, 부산, 제주 대략적 좌표
          if (data.address.includes('서울')) {
            coordinates = { lat: 37.5665, lng: 126.9780 };
          } else if (data.address.includes('부산')) {
            coordinates = { lat: 35.1796, lng: 129.0756 };
          } else if (data.address.includes('제주')) {
            coordinates = { lat: 33.4996, lng: 126.5312 };
          } else {
            coordinates = { lat: 37.5665, lng: 126.9780 }; // 기본값
          }
        }

        // Amenity 생성 또는 찾기
        const amenityDetail = data.amenities.join(', ');
        let amenity = await Amenity.findOne({ amenityName: data.lodgingName });
        if (!amenity) {
          amenity = await Amenity.create({
            amenityName: data.lodgingName,
            amenityDetail: amenityDetail
          });
        }

        // category 추론 (명시되지 않은 경우)
        const category = data.category || inferCategory(data.address, data.lodgingName);

        // Lodging 생성
        const lodging = await Lodging.create({
          lodgingName: data.lodgingName,
          address: data.address,
          rating: data.rating,
          reviewCount: data.reviewCount,
          minPrice: data.minPrice,
          lat: coordinates.lat,
          lng: coordinates.lng,
          description: data.description,
          images: data.images,
          country: data.country,
          category: category,
          hashtag: data.hashtag || [],
          businessId: businessId,
          amenityId: amenity._id
        });

        lodgings.push(lodging);
        console.log(`✅ ${data.lodgingName} 생성 완료`);
      } catch (error) {
        console.error(`❌ ${data.lodgingName} 생성 실패:`, error.message);
      }
    }

    console.log(`✅ 총 ${lodgings.length}개 숙소 생성 완료`);

    // ===== 4. Room 데이터 정의 및 삽입 =====
    console.log('🛏️  객실 데이터 삽입 중...');
    const rooms = [];

    const roomData = [
      // 롯데호텔 서울 (lodgings[0])
      {
        lodgingIndex: 0,
        roomName: '디럭스 더블룸',
        roomSize: '더블',
        price: 250000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 10,
        roomImage: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32',
        status: 'active'
      },
      {
        lodgingIndex: 0,
        roomName: '이그제큐티브 스위트',
        roomSize: '스위트',
        price: 450000,
        capacityMin: 4,
        capacityMax: 4,
        countRoom: 5,
        roomImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b',
        status: 'active'
      },
      {
        lodgingIndex: 0,
        roomName: '스탠다드 트윈룸',
        roomSize: '트윈',
        price: 220000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 15,
        roomImage: 'https://images.unsplash.com/photo-1590490360182-c33d57733427',
        status: 'active'
      },
      // 롯데호텔 부산 (lodgings[1])
      {
        lodgingIndex: 1,
        roomName: '오션뷰 더블룸',
        roomSize: '더블',
        price: 180000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 12,
        roomImage: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304',
        status: 'active'
      },
      {
        lodgingIndex: 1,
        roomName: '패밀리 스위트',
        roomSize: '스위트',
        price: 320000,
        capacityMin: 4,
        capacityMax: 4,
        countRoom: 8,
        roomImage: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6',
        status: 'active'
      },
      {
        lodgingIndex: 1,
        roomName: '스탠다드 시티뷰',
        roomSize: '더블',
        price: 150000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 20,
        roomImage: 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061',
        status: 'active'
      },
      // 신라호텔 제주 (lodgings[2])
      {
        lodgingIndex: 2,
        roomName: '프리미엄 오션뷰',
        roomSize: '더블',
        price: 320000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 15,
        roomImage: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461',
        status: 'active'
      },
      {
        lodgingIndex: 2,
        roomName: '로얄 스위트',
        roomSize: '스위트',
        price: 650000,
        capacityMin: 4,
        capacityMax: 4,
        countRoom: 3,
        roomImage: 'https://images.unsplash.com/photo-1615460549969-36fa19521a4f',
        status: 'active'
      },
      {
        lodgingIndex: 2,
        roomName: '가든뷰 트윈룸',
        roomSize: '트윈',
        price: 280000,
        capacityMin: 2,
        capacityMax: 2,
        countRoom: 18,
        roomImage: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7',
        status: 'active'
      }
    ];

    for (const data of roomData) {
      if (lodgings[data.lodgingIndex]) {
        const room = await Room.create({
          lodgingId: lodgings[data.lodgingIndex]._id,
          roomName: data.roomName,
          roomSize: data.roomSize,
          capacityMin: data.capacityMin,
          capacityMax: data.capacityMax,
          checkInTime: '15:00',
          checkOutTime: '11:00',
          roomImage: data.roomImage,
          price: data.price,
          countRoom: data.countRoom,
          ownerDiscount: 0,
          platformDiscount: 0,
          status: data.status
        });
        rooms.push(room);
        console.log(`✅ ${data.roomName} 생성 완료`);
      }
    }

    console.log(`✅ 총 ${rooms.length}개 객실 생성 완료`);

    // ===== 5. Booking 데이터 정의 및 삽입 =====
    console.log('📅 예약 데이터 삽입 중...');
    const bookings = [];
    const users = []; // 각 예약마다 생성된 User 저장

    const bookingData = [
      {
        roomIndex: 0, // 롯데호텔 서울 - 디럭스 더블룸
        checkinDate: new Date('2024-11-01'),
        checkoutDate: new Date('2024-11-03'),
        adult: 2,
        child: 0,
        userName: '김철수',
        userEmail: 'user1@test.com',
        userPhone: '010-1111-1111'
      },
      {
        roomIndex: 1, // 롯데호텔 서울 - 이그제큐티브 스위트
        checkinDate: new Date('2024-10-15'),
        checkoutDate: new Date('2024-10-17'),
        adult: 2,
        child: 0,
        userName: '이영희',
        userEmail: 'user2@test.com',
        userPhone: '010-2222-2222'
      },
      {
        roomIndex: 3, // 롯데호텔 부산 - 오션뷰 더블룸
        checkinDate: new Date('2024-11-10'),
        checkoutDate: new Date('2024-11-12'),
        adult: 2,
        child: 0,
        userName: '박민수',
        userEmail: 'user3@test.com',
        userPhone: '010-3333-3333'
      },
      {
        roomIndex: 4, // 롯데호텔 부산 - 패밀리 스위트
        checkinDate: new Date('2024-10-20'),
        checkoutDate: new Date('2024-10-22'),
        adult: 2,
        child: 2,
        userName: '최지은',
        userEmail: 'user4@test.com',
        userPhone: '010-4444-4444'
      },
      {
        roomIndex: 6, // 신라호텔 제주 - 프리미엄 오션뷰
        checkinDate: new Date('2024-11-15'),
        checkoutDate: new Date('2024-11-17'),
        adult: 2,
        child: 0,
        userName: '정수현',
        userEmail: 'user5@test.com',
        userPhone: '010-5555-5555'
      },
      {
        roomIndex: 8, // 신라호텔 제주 - 가든뷰 트윈룸
        checkinDate: new Date('2024-10-25'),
        checkoutDate: new Date('2024-10-27'),
        adult: 2,
        child: 0,
        userName: '강동욱',
        userEmail: 'user6@test.com',
        userPhone: '010-6666-6666'
      }
    ];

    for (const data of bookingData) {
      if (rooms[data.roomIndex]) {
        const room = rooms[data.roomIndex];
        // lodging에서 businessId 가져오기
        const lodging = lodgings.find(l => l._id.toString() === room.lodgingId.toString());
        
        if (lodging) {
          // 각 예약마다 새로운 User 생성
          let user = await User.findOne({ email: data.userEmail });
          if (!user) {
            user = new User({
              name: data.userName,
              email: data.userEmail,
              phoneNumber: data.userPhone,
              role: 'USER',
              isActive: true
            });
            await user.setPassword('password123');
            await user.save();
          }
          users.push(user);

          const duration = calculateDuration(data.checkinDate, data.checkoutDate);
          // 예약 날짜는 체크인 날짜보다 7일 전으로 설정
          const bookingDate = new Date(data.checkinDate);
          bookingDate.setDate(bookingDate.getDate() - 7);
          
          const booking = await Booking.create({
            roomId: room._id,
            userId: user._id,
            businessId: lodging.businessId,
            adult: data.adult,
            child: data.child,
            checkinDate: data.checkinDate,
            checkoutDate: data.checkoutDate,
            bookingDate: bookingDate,
            duration: duration,
            bookingStatus: 'completed',
            paymentStatus: 'paid'
          });
          
          bookings.push(booking);
          console.log(`✅ 예약 생성 완료 (${lodging.lodgingName} - ${room.roomName} / ${data.userName})`);
        }
      }
    }

    console.log(`✅ 총 ${bookings.length}개 예약 생성 완료`);

    // ===== 6. Review 데이터 삽입 =====
    console.log('⭐ 리뷰 데이터 삽입 중...');
    
    const reviewData = [
      {
        bookingIndex: 0,
        rating: 5,
        content: '위치도 좋고 시설도 깨끗했어요. 직원분들도 친절하셨습니다. 다음에 또 이용하고 싶어요!',
        images: []
      },
      {
        bookingIndex: 1,
        rating: 4,
        content: '스위트룸이 정말 넓고 좋았습니다. 조식도 훌륭했어요. 단, 주차장이 협소한 것이 아쉬웠습니다.',
        images: []
      },
      {
        bookingIndex: 2,
        rating: 5,
        content: '오션뷰가 정말 환상적이었습니다! 해변 접근도 쉽고 가족 여행하기 좋았어요.',
        images: []
      },
      {
        bookingIndex: 3,
        rating: 4,
        content: '패밀리 스위트가 넓어서 아이들과 지내기 좋았습니다. 주방이 있어서 편리했어요.',
        images: []
      },
      {
        bookingIndex: 4,
        rating: 5,
        content: '제주 여행의 하이라이트였습니다. 리조트 시설이 최고였고, 오션뷰가 정말 아름다웠어요!',
        images: []
      },
      {
        bookingIndex: 5,
        rating: 5,
        content: '가든뷰도 예쁘고 조용해서 휴식하기 좋았습니다. 스파도 최고였어요. 강추!',
        images: []
      }
    ];

    const reviews = [];
    for (const data of reviewData) {
      if (bookings[data.bookingIndex]) {
        const booking = bookings[data.bookingIndex];
        const room = rooms.find(r => r._id.toString() === booking.roomId.toString());
        
        if (room) {
          const lodging = lodgings.find(l => l._id.toString() === room.lodgingId.toString());

          if (lodging) {
            // 각 예약에 해당하는 User 찾기
            const user = users.find(u => u._id.toString() === booking.userId.toString());
            
            if (user) {
              const review = await Review.create({
                lodgingId: lodging._id,
                userId: user._id,
                bookingId: booking._id,
                rating: data.rating,
                content: data.content,
                images: data.images,
                status: 'active'
              });
              reviews.push(review);
              console.log(`✅ 리뷰 생성 완료 (${lodging.lodgingName} / ${user.name})`);
            }
          }
        }
      }
    }

    console.log(`✅ 총 ${reviews.length}개 리뷰 생성 완료`);

    // ===== 최종 결과 출력 =====
    console.log('\n🎉 초기 데이터 삽입 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 생성된 데이터 요약:`);
    console.log(`  • 사용자: ${await User.countDocuments()}명`);
    console.log(`  • 사업자: ${await Business.countDocuments()}명`);
    console.log(`  • 편의시설: ${await Amenity.countDocuments()}개`);
    console.log(`  • 숙소: ${await Lodging.countDocuments()}개`);
    console.log(`  • 객실: ${await Room.countDocuments()}개`);
    console.log(`  • 예약: ${await Booking.countDocuments()}개`);
    console.log(`  • 리뷰: ${await Review.countDocuments()}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // MongoDB 연결 종료
    await mongoose.connection.close();
    console.log('✅ MongoDB 연결 종료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터 삽입 중 오류 발생:', error);
    // 에러 발생 시에도 연결 종료
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// 스크립트 실행
seedDatabase();

