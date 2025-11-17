const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    // ERD: notice 테이블
    own_hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnHotel',
      required: true,
      unique: true,
      index: true
    },
    content: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    usage_guide: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    introduction: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    }
  },
  {
    timestamps: false,
    collection: 'notice'
  }
);

module.exports = mongoose.model('Notice', noticeSchema);

