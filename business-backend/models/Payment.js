const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // ERD: payments 테이블
    reserve_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
      unique: true,
      index: true
    },
    payment_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentType',
      required: true
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    paid: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true,
    collection: 'payments'
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

