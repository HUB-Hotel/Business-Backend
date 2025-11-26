const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    // ERD: reservations 테이블
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    own_hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnHotel',
      required: true,
      index: true
    },
    start_date: {
      type: Date,
      required: true
    },
    end_date: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true,
      min: 1
    },
    person_count: {
      type: Number,
      required: true,
      min: 1
    },
    // 사업자 정보 (ERD에는 없지만 사업자 백엔드에서 필요)
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    // 추가 상태 관리 필드 (사업자 백엔드에서 필요)
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'reservations'
  }
);

reservationSchema.index({ business: 1, createdAt: -1 });
reservationSchema.index({ hotel_id: 1, status: 1 });
reservationSchema.index({ own_hotel_id: 1 });
reservationSchema.index({ start_date: 1, end_date: 1 });
reservationSchema.index({ status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);

