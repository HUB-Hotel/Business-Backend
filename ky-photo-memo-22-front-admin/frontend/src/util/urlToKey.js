const PUBLIC_BASE = import.meta.env.VITE_S3_PUBLIC_BASE || "";

export const urlToKey = (u) => {
  if (!u) return "";
  const s = String(u);
  if (!/^https?:\/\//i.test(s)) return s; // 이미 key
  if (PUBLIC_BASE) {
    const base = PUBLIC_BASE.replace(/\/+$/, "");
    return s.startsWith(base + "/") ? s.slice(base.length + 1) : s;
  }
  try {
    const url = new URL(s);
    return url.pathname.replace(/^\/+/, ""); // /uploads/.. → uploads/..
  } catch {
    return s; // fallback
  }
};
