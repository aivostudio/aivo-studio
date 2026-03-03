// api/providers/replicate/predictions/status.js

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: false, error: "method_not_allowed" });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(200).json({ ok: false, error: "missing_replicate_token" });
    }

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const id = body?.id;
    if (!id) {
      return res.status(200).json({ ok: false, error: "missing_id" });
    }

    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Token ${token}`,
        "Accept": "application/json",
      },
    });

    // Replicate "404" (veya başka) gelse bile biz 200 dönüyoruz; hata JSON’da.
    if (!r.ok) {
      let detail = null;
      try { detail = await r.json(); } catch { detail = await r.text().catch(() => null); }
      return res.status(200).json({
        ok: false,
        error: "replicate_status_failed",
        status: r.status,
        detail,
        id,
      });
    }

    const j = await r.json();
    const status = j?.status || "unknown";

    // output URL’leri bazen "succeeded" olsa bile birkaç saniye 404 verebiliyor.
    // Bu durumda "processing" dönüp poll’un devam etmesini istiyoruz.
    const collectUrls = (out) => {
      const urls = [];
      if (!out) return urls;
      if (typeof out === "string") urls.push(out);
      else if (Array.isArray(out)) out.forEach((x) => typeof x === "string" && urls.push(x));
      else if (typeof out === "object") {
        for (const k of Object.keys(out)) {
          const v = out[k];
          if (typeof v === "string") urls.push(v);
          else if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && urls.push(x));
        }
      }
      return urls;
    };

    const outputUrls = collectUrls(j.output);

    const isUrlReachable = async (url) => {
      // HEAD bazı edge’lerde sorun çıkarabiliyor; 0-0 range GET en güvenlisi
      const rr = await fetch(url, { method: "GET", headers: { "Range": "bytes=0-0" } });
      return rr.status === 200 || rr.status === 206;
    };

    if (status === "succeeded" && outputUrls.length) {
      // İlk 1-2 url’i hızlı kontrol et (ağ maliyeti düşük)
      const sample = outputUrls.slice(0, 2);
      for (const u of sample) {
        try {
          const ok = await isUrlReachable(u);
          if (!ok) {
            return res.status(200).json({
              ok: true,
              mode: "status",
              id,
              status: "processing",
              output: null,
              logs: "delivery_pending",
            });
          }
        } catch {
          return res.status(200).json({
            ok: true,
            mode: "status",
            id,
            status: "processing",
            output: null,
            logs: "delivery_pending",
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      mode: "status",
      id,
      status,
      output: j.output ?? null,
      logs: j.logs ?? null,
      error: j.error ?? null,
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
