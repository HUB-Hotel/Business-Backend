require('dotenv').config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");

const BusinessUser = require("../src/auth/model");
const Lodging = require("../src/lodging/model");
const Room = require("../src/room/model");
const Notice = require("../src/notice/model");

// 공지사항 샘플 데이터
const sampleNotices = [
  {
    content: "체크인 시간은 오후 3시부터입니다.",
    usageGuide: "객실 내 금연입니다. 흡연 시 추가 청소비가 발생할 수 있습니다.",
    introduction: "편안하고 쾌적한 숙박을 위해 최선을 다하겠습니다."
  },
  {
    content: "체크아웃 시간은 오전 11시까지입니다.",
    usageGuide: "객실 내 시설물 사용 시 주의해주시기 바랍니다.",
    introduction: "고객님의 만족을 위해 항상 노력하겠습니다."
  },
  {
    content: "무료 와이파이를 이용하실 수 있습니다.",
    usageGuide: "주차 공간이 제한적이니 사전에 문의해주시기 바랍니다.",
    introduction: "깨끗하고 안전한 숙박 환경을 제공합니다."
  },
  {
    content: "조식은 매일 오전 7시부터 10시까지 제공됩니다.",
    usageGuide: "객실 내 소음에 주의해주시기 바랍니다.",
    introduction: "최고의 서비스로 모시겠습니다."
  },
  {
    content: "24시간 프론트 데스크 서비스를 이용하실 수 있습니다.",
    usageGuide: "객실 내 취사는 불가능합니다.",
    introduction: "편안한 휴식을 위해 최선을 다하겠습니다."
  }
];

async function createNoticesForRooms() {
  try {
    await connectDB();
    console.log("MongoDB 연결 성공\n");

    // 모든 사업자 조회
    const businessUsers = await BusinessUser.find({ role: 'business' })
      .sort({ createdAt: 1 })
      .lean();
    
    console.log(`사업자 수: ${businessUsers.length}개\n`);

    if (businessUsers.length === 0) {
      console.log("사업자가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    let totalNoticesCreated = 0;
    let totalNoticesSkipped = 0;
    let totalRoomsProcessed = 0;

    // 각 사업자별로 처리
    for (const businessUser of businessUsers) {
      const businessId = businessUser._id;
      
      // 해당 사업자의 숙소 조회 (businessId로)
      const lodgings = await Lodging.find({ businessId: businessId }).lean();
      
      if (lodgings.length === 0) {
        console.log(`⏭️  ${businessUser.name} (${businessUser.email}): 숙소 없음`);
        continue;
      }

      console.log(`\n📌 ${businessUser.name} (${businessUser.email})`);
      console.log(`   숙소 수: ${lodgings.length}개`);

      // 각 숙소의 객실 조회
      for (const lodging of lodgings) {
        const rooms = await Room.find({ lodgingId: lodging._id }).lean();
        
        if (rooms.length === 0) {
          console.log(`   ⏭️  ${lodging.lodgingName}: 객실 없음`);
          continue;
        }

        console.log(`   🏨 ${lodging.lodgingName}: 객실 ${rooms.length}개`);

        // 각 객실에 공지사항 생성
        for (let i = 0; i < rooms.length; i++) {
          const room = rooms[i];
          totalRoomsProcessed++;

          try {
            // 이미 공지사항이 있는지 확인
            const existingNotice = await Notice.findOne({ roomId: room._id });
            
            if (existingNotice) {
              console.log(`      ⏭️  ${room.name}: 공지사항 이미 존재`);
              totalNoticesSkipped++;
              continue;
            }

            // 샘플 공지사항 중 하나 선택 (순환)
            const sampleNotice = sampleNotices[i % sampleNotices.length];

            // 공지사항 생성
            await Notice.create({
              roomId: room._id,
              content: sampleNotice.content,
              usageGuide: sampleNotice.usageGuide,
              introduction: sampleNotice.introduction
            });

            console.log(`      ✅ ${room.name}: 공지사항 생성 완료`);
            totalNoticesCreated++;

          } catch (error) {
            if (error.code === 11000) {
              // 중복 키 오류 (이미 존재)
              console.log(`      ⏭️  ${room.name}: 공지사항 이미 존재 (중복 키)`);
              totalNoticesSkipped++;
            } else {
              console.error(`      ❌ ${room.name}: 공지사항 생성 실패 - ${error.message}`);
            }
          }
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 처리 완료:`);
    console.log(`  📝 생성된 공지사항: ${totalNoticesCreated}개`);
    console.log(`  ⏭️  스킵된 공지사항: ${totalNoticesSkipped}개 (이미 존재)`);
    console.log(`  🏨 처리된 객실 수: ${totalRoomsProcessed}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await mongoose.disconnect();
    console.log("MongoDB 연결 종료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createNoticesForRooms();

