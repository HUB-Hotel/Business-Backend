const mongoose = require("mongoose");

const ownHotelPictureSchema = new mongoose.Schema(
  {
    // ERD: own_hotel_pictures 테이블
    own_hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnHotel',
      required: true,
      index: true
    },
    picture_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    picture_url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    }
  },
  {
    timestamps: true,
    collection: 'own_hotel_pictures'
  }
);

ownHotelPictureSchema.index({ own_hotel_id: 1, createdAt: -1 });

module.exports = mongoose.model('OwnHotelPicture', ownHotelPictureSchema);

