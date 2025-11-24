const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // 호텔 정보
    lodging_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    // 리뷰 작성자
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    // 예약 이력 (리뷰 작성 권한 확인용)
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    
    // 평점 (1-5)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    
    // 리뷰 내용
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    
    // 리뷰 이미지
    images: {
      type: [String],
      default: [],
      trim: true
    },
    
    // 리뷰 상태
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
      index: true
    },
    
    // 차단 시간
    blocked_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'reviews'
  }
);

// 복합 인덱스
reviewSchema.index({ lodging_id: 1, status: 1, created_at: -1 });
reviewSchema.index({ user_id: 1, created_at: -1 });
reviewSchema.index({ booking_id: 1 }, { unique: true }); // 한 예약당 하나의 리뷰만 작성 가능

module.exports = mongoose.model('Review', reviewSchema);

