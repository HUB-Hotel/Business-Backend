const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const businessSchema = new mongoose.Schema(
  {
    // 🔐 로그인 / 인증 기본
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "유효한 이메일"],
      unique: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    // 🏨 사업자 정보 기본
    businessName: {
      type: String,          // 상호명
      required: true,
      trim: true
    },
    ownerName: {
      type: String,          // 대표자명
      trim: true,
      default: ""
    },
    phone: {
      type: String,          // 대표 연락처
      trim: true,
      default: ""
    },

    // 🧾 사업자 등록 관련
    businessNumber: {
      type: String,          // 사업자등록번호
      trim: true,
      default: "",
      unique: true,          // 하나의 번호로 여러 계정 생성 못하게
      sparse: true
    },
    mailOrderNumber: {
      type: String,          // 통신판매업(판매업자 신고) 번호
      trim: true,
      default: "",
      unique: true,
      sparse: true
    },

    // 🏢 업종/유형 및 주소
    businessType: {
      type: String,
      enum: ["hotel", "motel", "guesthouse", "resort", "etc"],
      default: "hotel"
    },
    zipCode: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    addressDetail: {
      type: String,
      trim: true,
      default: ""
    },

    // ✅ 승인/검수 상태
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"], // 가입 → pending, 관리자 승인 후 approved
      default: "pending",
      index: true
    },
    approvedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    rejectedReason: {
      type: String,
      trim: true,
      default: ""
    },

    // 📎 서류/증빙(필요하면)
    verification: {
      businessRegCertificateUrl: {
        type: String,
        trim: true,
        default: ""
      },
      mailOrderCertificateUrl: {
        type: String,
        trim: true,
        default: ""
      },
      note: {
        type: String,
        trim: true,
        default: ""
      }
    },

    // 🔑 권한 / 계정 관리
    role: {
      type: String,
      enum: ["business"],
      default: "business",
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },

    // 🔒 로그인 보안 관련
    lastLoginAttempt: {
      type: Date
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    tokenVersion: {
      type: Number,
      default: 0,
      index: true
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

// ----------------------
// 메서드들
// ----------------------
businessSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

businessSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

businessSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.passwordHash;
  return obj;
};

businessSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model("Business", businessSchema);
