// api/cover/generate.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { prompt } = req.body || {};
    const p = (prompt || "").trim();

    if (!p) return res.status(400).json({ ok: false, error: "Prompt boş" });

    // Şimdilik MOCK görsel: prompt seed'li placeholder (gerçek model sonra bağlanır)
    const seed = encodeURIComponent(p.slice(0, 120));
    const imageUrl = `https://picsum.photos/seed/${seed}/768/768`;

    return res.status(200).json({
      ok: true,
      type: "cover",
      imageUrl,
      prompt: p,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
