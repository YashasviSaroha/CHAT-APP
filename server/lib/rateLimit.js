const buckets = new Map();

export function rateLimit({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : `${req.ip}:${req.path}`;
    const recent = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ success: false, message: "Too many requests. Try again shortly." });
    }
    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}

const socketBuckets = new Map();

export function allowSocketSend(userId, limit = 20, windowMs = 10_000) {
  const now = Date.now();
  const key = String(userId);
  const recent = (socketBuckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  socketBuckets.set(key, recent);
  return true;
}
