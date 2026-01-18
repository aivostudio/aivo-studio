// ⚠️ scan dönüşü bazı redis client’larda [cursor, keys] olur
let cursor = 0;
let keys = [];

try {
  const resScan = await redis.scan(0, { match: "ban:*", count: 100 });

  // 1) Array format: [cursor, keys]
  if (Array.isArray(resScan)) {
    cursor = Number(resScan[0] || 0);
    keys = Array.isArray(resScan[1]) ? resScan[1] : [];
  }
  // 2) Object format: { cursor, keys }
  else if (resScan && typeof resScan === "object") {
    cursor = Number(resScan.cursor || 0);
    keys = Array.isArray(resScan.keys) ? resScan.keys : [];
  } else {
    keys = [];
  }
} catch (e) {
  keys = [];
}

const items = [];
for (const k of keys) {
  const v = await kvGetJson(k);
  if (v && v.email) items.push(v);
}

return json(res, 200, { ok: true, count: items.length, items });
