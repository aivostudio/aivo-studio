// api/admin/production-stats.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    const redis = getRedis();

    const modules = [
      { key: "music",   label: "AI Müzik Üret" },
      { key: "cover",   label: "AI Kapak Üret" },
      { key: "atmo",    label: "AI Atmosfer Video" },
      { key: "cartoon", label: "AI Çocuk Çizgifilm" },
      { key: "photofx", label: "AI Foto Efekt Video Clip" },
      { key: "video",   label: "AI Resimden Video Üret" }
    ];

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dayKey = `${yyyy}-${mm}-${dd}`;

    const stats = [];

    for (const mod of modules) {
      const totalKey = `stats:${mod.key}:total`;
      const dailyKey = `stats:${mod.key}:daily:${dayKey}`;

      const [totalRaw, dailyRaw] = await Promise.all([
        redis.get(totalKey),
        redis.get(dailyKey)
      ]);

      stats.push({
        key: mod.key,
        label: mod.label,
        daily: Number(dailyRaw || 0),
        total: Number(totalRaw || 0)
      });
    }

    return res.status(200).json({
      ok: true,
      day: dayKey,
      stats
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "production_stats_failed"
    });
  }
};
