// src/util/toPublicUrl.js
const PUBLIC_BASE = import.meta.env.VITE_S3_PUBLIC_BASE || "";

export function toPublicUrl(u) {
  if (!u) return "";
  const s = String(u);

  // 이미 절대 URL이면 그대로 사용
  if (/^https?:\/\//i.test(s)) return s;

  // 키라면 PUBLIC_BASE + 키
  if (!PUBLIC_BASE) return s; // (안전장치) 베이스가 없으면 그대로 반환
  const base = PUBLIC_BASE.replace(/\/+$/, "");
  return `${base}/${s.replace(/^\/+/, "")}`;
}
