const mongoose = require("mongoose");

const facilitySchema = new mongoose.Schema(
  {
    // ERD: facilities 테이블
    service_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    service_detail: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    }
  },
  {
    timestamps: false,
    collection: 'facilities'
  }
);

module.exports = mongoose.model('Facility', facilitySchema);

