const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    // ERD: hotels 테이블
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    tel: {
      type: String,
      trim: true,
      maxlength: 20,
      default: ""
    },
    owner: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    business_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    regist_number: {
      type: String,
      trim: true,
      maxlength: 20,
      default: ""
    },
    region: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    facility_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true
    },
    // 사업자 정보 (ERD에는 없지만 사업자 백엔드에서 필요)
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'hotels'
  }
);

hotelSchema.index({ business: 1, createdAt: -1 });
hotelSchema.index({ region: 1 });
hotelSchema.index({ facility_id: 1 });

module.exports = mongoose.model('Hotel', hotelSchema);

