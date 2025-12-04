require('dotenv').config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");

const BusinessUser = require("../src/auth/model");
const Lodging = require("../src/lodging/model");

async function assignBusinessIdsToLodgings() {
  try {
    await connectDB();
    console.log("MongoDB 연결 성공\n");

    // BusinessUser 50개 순서대로 조회 (생성일 순)
    const businessUsers = await BusinessUser.find({ role: 'business' })
      .limit(50)
      .sort({ createdAt: 1 })
      .lean();
    
    console.log(`사업자 수: ${businessUsers.length}개\n`);

    if (businessUsers.length === 0) {
      console.log("사업자가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    // Lodging 50개 순서대로 조회 (생성일 순)
    const lodgings = await Lodging.find()
      .limit(50)
      .sort({ createdAt: 1 })
      .lean();
    
    console.log(`숙소 수: ${lodgings.length}개\n`);

    if (lodgings.length === 0) {
      console.log("숙소가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    // 사업자 수와 숙소 수 확인
    const minCount = Math.min(businessUsers.length, lodgings.length);
    console.log(`배정할 수: ${minCount}개\n`);

    let successCount = 0;
    let errorCount = 0;

    // 순서대로 배정
    for (let i = 0; i < minCount; i++) {
      try {
        const businessUser = businessUsers[i];
        const lodging = lodgings[i];

        const businessId = businessUser._id;
        const businessName = businessUser.businessName || businessUser.name || "";

        if (!businessName) {
          console.warn(`⚠️  [${i + 1}] businessName이 없음 (사업자: ${businessId})`);
          errorCount++;
          continue;
        }

        // 업데이트 실행
        await Lodging.updateOne(
          { _id: lodging._id },
          {
            $set: {
              businessId: businessId,
              businessName: businessName
            }
          }
        );

        console.log(`✅ [${i + 1}] ${lodging.lodgingName || lodging._id}:`);
        console.log(`   - businessId: ${businessId}`);
        console.log(`   - businessName: ${businessName}`);
        successCount++;

      } catch (error) {
        console.error(`❌ [${i + 1}] 숙소 ${lodgings[i]._id} 배정 실패:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 배정 완료:`);
    console.log(`  ✅ 성공: ${successCount}개`);
    console.log(`  ❌ 실패: ${errorCount}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await mongoose.disconnect();
    console.log("MongoDB 연결 종료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

assignBusinessIdsToLodgings();

