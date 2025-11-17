const mongoose = require("mongoose");

const ownHotelSchema = new mongoose.Schema(
  {
    // ERD: own_hotels 테이블
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    count_room: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    check_in: {
      type: String,
      required: true,
      default: "15:00"
    },
    check_out: {
      type: String,
      required: true,
      default: "11:00"
    },
    room_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    room_type: {
      type: String,
      trim: true,
      maxlength: 50,
      default: ""
    },
    max_person: {
      type: Number,
      required: true,
      min: 1
    },
    min_person: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    owner_discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    platform_discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true,
    collection: 'own_hotels'
  }
);

ownHotelSchema.index({ hotel_id: 1, createdAt: -1 });

module.exports = mongoose.model('OwnHotel', ownHotelSchema);

