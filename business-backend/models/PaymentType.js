const mongoose = require("mongoose");

const paymentTypeSchema = new mongoose.Schema(
  {
    // ERD: payment_types 테이블
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    type_code: {
      type: Number,
      required: true,
      unique: true
    }
  },
  {
    timestamps: false,
    collection: 'payment_types'
  }
);

module.exports = mongoose.model('PaymentType', paymentTypeSchema);

