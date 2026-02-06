// api/music/generate.js  (Vercel / Next.js API Route örneği)
// ✅ writes: providers/music/{provider_job_id}.json  (mapping)
// ✅ later writes: jobs/{internal}/outputs/index.json + jobs/{internal}/outputs/{outputId}.json
//
// ENV gerekli:
// R2_ACCOUNT_ID
// R2_ACCESS_KEY_ID
// R2_SECRET_ACCESS_KEY
// R2_BUCKET               (senin worker’daki env.R2_BUCKET ile aynı bucket adı)
//
// Provider tarafı (örnek):
// - generate -> { ok:true, job_id:"job_xxx", status:"queued" }
// - status   -> { state:"processing|ready", output_id:"...", file_key:"files/...", mime:"audio/mpeg", file_name:"..." }
//   (Sende provider status yoksa, bu kısmı webhook'a taşıyacaksın.)

import crypto from "crypto";

// --------- R2 S3 PUT helper (fetch ile) ----------
async function r2PutJson({ key, data, env }) {
  const body = JSON.stringify(data, null, 2);
  return r2PutObject({
    key,
    body,
    contentType: "application/json; charset=utf-8",
    env,
  });
}

async function r2PutObject({ key, body, contentType, env }) {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
  } = env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Missing R2 env vars");
  }

  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${encodeURIComponent(R2_BUCKET)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  // AWS SigV4 (minimal) — aynı presign mantığı gibi, ama Authorization header ile PUT
  const region = "auto";
  const service = "s3";
  const method = "PUT";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const sha256Hex = async (input) => {
    const hash = crypto.createHash("sha256");
    hash.update(input);
    return hash.digest("hex");
  };
  const hmac = (keyBuf, str) => crypto.createHmac("sha256", keyBuf).update(str).digest();
  const hmacHex = (keyBuf, str) => crypto.createHmac("sha256", keyBuf).update(str).digest("hex");

  const payloadHash = await sha256Hex(body);

  const canonicalUri = `/${R2_BUCKET}/${key}`;
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
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = hmac(Buffer.from("AWS4" + R2_SECRET_ACCESS_KEY, "utf8"), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmacHex(kSigning, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHash,
      "Authorization": authorization,
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`R2 PUT failed: ${res.status} ${t.slice(0, 300)}`);
  }

  return true;
}

// --------- Provider API placeholders ----------
async function providerGenerate({ prompt }) {
  // TODO: senin gerçek provider call’un
  // return { ok:true, job_id:"job_xxx", status:"queued" }
  throw new Error("providerGenerate not implemented");
}

async function providerStatus({ provider_job_id }) {
  // TODO: senin gerçek provider status call’un
  // ready olunca output_id + file_key dönmeli
  // return { state:"processing" }
  // return { state:"ready", output_id:"OUT_01", file_key:"files/<uuid>/<out>/<name>.mp3", mime:"audio/mpeg", file_name:"..." }
  throw new Error("providerStatus not implemented");
}

// --------- API Route: /api/music/generate ----------
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  try {
    const prompt = req.body?.prompt || "";
    // 1) provider generate
    const gen = await providerGenerate({ prompt });
    if (!gen?.job_id) return res.status(500).json({ ok:false, error:"provider_no_job_id", gen });

    const provider_job_id = gen.job_id;

    // 2) internal job id üret
    const internal_job_id = crypto.randomUUID();

    // 3) mapping'i R2'ye yaz (worker bunu okuyacak)
    await r2PutJson({
      key: `providers/music/${provider_job_id}.json`,
      data: { provider_job_id, internal_job_id, createdAt: Date.now() },
      env: process.env,
    });

    // 4) Client'a hem provider hem internal döndür (Studio için altın değer)
    // Studio provider ile poll eder, internal gelince jobs/status + play çalışır.
    return res.status(200).json({
      ok: true,
      provider_job_id,
      internal_job_id,
      status: gen.status || "queued",
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error:"server_error", message: String(e?.message || e) });
  }
}

// --------- (Opsiyonel) API Route: /api/music/sync (poll + output yaz)
// Bunu cron/webhook yerine manuel trigger olarak kullanabilirsin.
// POST { provider_job_id } => ready ise outputs index/meta yazar.
export async function syncHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  try {
    const provider_job_id = req.body?.provider_job_id;
    if (!provider_job_id) return res.status(400).json({ ok:false, error:"missing_provider_job_id" });

    // mapping'i okuyup internal'ı bulmak için normalde R2 GET gerekir.
    // Basitlik için: mapping'i aynı anda DB/KV'de de tut veya generate response'dan internal'ı geçir.
    const internal_job_id = req.body?.internal_job_id;
    if (!internal_job_id) return res.status(400).json({ ok:false, error:"missing_internal_job_id" });

    const st = await providerStatus({ provider_job_id });
    if (!st || !st.state) return res.status(500).json({ ok:false, error:"provider_status_invalid", st });

    if (st.state !== "ready") {
      return res.status(200).json({ ok:true, state: st.state });
    }

    const output_id = st.output_id || crypto.randomUUID();
    const meta = {
      output_id,
      job_id: internal_job_id,
      kind: "music",
      createdAt: Date.now(),
      file_key: st.file_key,           // ✅ /files/play buradan okuyor
      file_name: st.file_name || null,
      mime: st.mime || "audio/mpeg",
      display_name: st.display_name || "AIVO Music",
    };

    // outputs index
    await r2PutJson({
      key: `jobs/${internal_job_id}/outputs/index.json`,
      data: { outputs: [output_id], updatedAt: Date.now() },
      env: process.env,
    });

    // output meta
    await r2PutJson({
      key: `jobs/${internal_job_id}/outputs/${output_id}.json`,
      data: meta,
      env: process.env,
    });

    return res.status(200).json({
      ok:true,
      state:"ready",
      provider_job_id,
      internal_job_id,
      output_id,
      mp3_url: `/files/play?job_id=${internal_job_id}&output_id=${output_id}`,
      wrote: {
        indexKey: `jobs/${internal_job_id}/outputs/index.json`,
        metaKey: `jobs/${internal_job_id}/outputs/${output_id}.json`,
      }
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error:"server_error", message: String(e?.message || e) });
  }
}
