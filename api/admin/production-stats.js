// api/admin/production-stats.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    const redis = getRedis();

     const modules = [
      { key: "music", label: "AI Müzik Üret", type: "plain" },
      { key: "cover", label: "AI Kapak Üret", type: "plain" },
      { key: "atmo", label: "AI Atmosfer Video", type: "plain" },

      { key: "cartoon", mode: "character", label: "AI Çocuk Çizgifilm — Karakter Yarat", type: "cartoon-mode" },
      { key: "cartoon", mode: "basic", label: "AI Çocuk Çizgifilm — Basit Mod", type: "cartoon-mode" },
      { key: "cartoon", mode: "story", label: "AI Çocuk Çizgifilm — Hikaye Modu", type: "cartoon-mode" },

      { key: "photofx", label: "AI Foto Efekt Video Clip", type: "plain" },
      { key: "video", label: "AI Resimden Video Üret", type: "plain" }
    ];
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dayKey = `${yyyy}-${mm}-${dd}`;

    const stats = [];

      for (const mod of modules) {
      const totalKey =
        mod.type === "cartoon-mode"
          ? `stats:${mod.key}:${mod.mode}:total`
          : `stats:${mod.key}:total`;

      const dailyKey =
        mod.type === "cartoon-mode"
          ? `stats:${mod.key}:${mod.mode}:daily:${dayKey}`
          : `stats:${mod.key}:daily:${dayKey}`;

      const [totalRaw, dailyRaw] = await Promise.all([
        redis.get(totalKey),
        redis.get(dailyKey)
      ]);

      stats.push({
        key: mod.type === "cartoon-mode" ? `${mod.key}:${mod.mode}` : mod.key,
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
