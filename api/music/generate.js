// /api/music/generate.js  (ESKİ ÇALIŞANI KORU + mapping best-effort ekle)
import crypto from "crypto";

// Session'dan email çek (cookie forward)
async function getEmailFromSession(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const origin = `${proto}://${host}`;

    const r = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      headers: { cookie: req.headers.cookie || "" },
    });

    if (!r.ok) return null;
    const me = await r.json().catch(() => ({}));
    return (me?.email || me?.user?.email || "").trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

function newProviderJobId() {
  return "job_" + crypto.randomBytes(12).toString("hex");
}
function newInternalJobId() {
  return crypto.randomUUID();
}

// ---------- R2 PUT JSON (best-effort) ----------
async function r2PutJsonBestEffort({ key, data }) {
  // ENV gerekli:
  // R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { ok: false, error: "missing_r2_env" };
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const method = "PUT";
  const region = "auto";
  const service = "s3";

  const body = JSON.stringify(data, null, 2);
  const contentType = "application/json; charset=utf-8";

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const sha256Hex = (input) => crypto.createHash("sha256").update(input).digest("hex");
  const hmac = (keyBuf, str) => crypto.createHmac("sha256", keyBuf).update(str).digest();
  const hmacHex = (keyBuf, str) => crypto.createHmac("sha256", keyBuf).update(str).digest("hex");

  const payloadHash = sha256Hex(body);

  // ⚠️ Key'de encode yok; canonicalUri ham olmalı
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${method}\n${canonicalUri}\n\n` +
    `${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(Buffer.from("AWS4" + secretAccessKey, "utf8"), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmacHex(kSigning, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "X-Amz-Date": amzDate,
        "X-Amz-Content-Sha256": payloadHash,
        "Authorization": authorization,
      },
      body,
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `r2_put_failed:${r.status}`, detail: t.slice(0, 200) };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: "r2_put_exception", detail: String(e?.message || e) };
  }
}

export default async function handler(req, res) {
  // Aynı origin’de CORS gereksiz; yine de OPTIONS’a cevap verelim
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    // 1) email body’den, yoksa session’dan
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) email = (await getEmailFromSession(req)) || "";

    // 2) provider job_id body’den, yoksa üret
    let provider_job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!provider_job_id) provider_job_id = newProviderJobId();

    if (!email) {
      return res.status(401).json({ ok: false, error: "auth_required" });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const mode = typeof body.mode === "string" ? body.mode : "instrumental";

    const duration_raw = body.duration_sec ?? body.durationSec ?? 30;
    const duration_sec = Number.isFinite(Number(duration_raw)) ? Number(duration_raw) : 30;

    // ✅ 3) internal job id üret (uuid)
    const internal_job_id = newInternalJobId();

    // ✅ 4) provider->internal mapping yaz (best-effort, asla 500'e çevirmiyoruz)
    const mapKey = `providers/music/${provider_job_id}.json`;
    const mappingWrite = await r2PutJsonBestEffort({
      key: mapKey,
      data: {
        provider_job_id,
        internal_job_id,
        email,
        createdAt: Date.now(),
      },
    });

    // ✅ ESKİ davranış: stub response (UI kuyruğa aldı sansın) + ekstra alanlar
    return res.status(200).json({
      ok: true,
      job_id: provider_job_id,        // geri uyum
      provider_job_id,                // net isim
      internal_job_id,                // ✅ yeni
      status: "queued",
      received: true,
      email,
      mode,
      duration_sec,
      prompt,
      ts: Date.now(),

      // debug (istersen sonra kaldırırsın)
      mapping_written: !!mappingWrite.ok,
      mapping_key: mapKey,
      mapping_error: mappingWrite.ok ? null : (mappingWrite.error || "unknown"),
      mapping_detail: mappingWrite.ok ? null : (mappingWrite.detail || null),
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err),
    });
  }
}
