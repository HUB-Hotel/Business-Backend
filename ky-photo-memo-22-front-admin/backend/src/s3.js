const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const required = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET",
];

const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
  console.error("[S3 ENV Missing]", missing);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const Bucket = process.env.S3_BUCKET;

async function presignPut(Key, ContentType, sec = 300) {
  if (!Bucket) throw new Error("s3 bucket is undefined");
  if (!Key) throw new Error("Key is required"); // 추가됨: Key 유효성 검사 추가

  const cmd = new PutObjectCommand({ Bucket, Key, ContentType });

  return getSignedUrl(s3, cmd, { expiresIn: sec });
}

async function presignGet(Key, sec = 300) {
  if (!Bucket) throw new Error("s3 bucket is undefined");
  if (!Key) throw new Error("Key is required"); // 추가됨: Key 유효성 검사 추가

  const cmd = new GetObjectCommand({ Bucket, Key });

  return getSignedUrl(s3, cmd, { expiresIn: sec });
}

async function deleteObject(Key) {
  if (!Bucket) throw new Error("s3 bucket is undefined");
  if (!Key) throw new Error("Key is required");

  const cmd = new DeleteObjectCommand({ Bucket, Key });

  await s3.send(cmd);

  console.log(`[s3] Deleted: ${Key}`);
  return { ok: true, message: `Deleted : ${Key}` };
}
async function updateObject(Key, Body, ContentType) {
  if (!Bucket) throw new Error("s3 bucket is undefined");
  if (!Key) throw new Error("Key is required");

  const cmd = new PutObjectCommand({
    Bucket,
    Key,
    Body,
    ContentType,
  });

  await s3.send(cmd);

  console.log(`[s3] Updated: ${Key}`);
  return { ok: true, message: `Updated : ${Key}` };
}

module.exports = {
  s3,
  presignPut,
  presignGet,
  Bucket,
  updateObject,
  deleteObject,
};
