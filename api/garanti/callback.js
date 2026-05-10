// /api/garanti/callback.js
// Garanti browser dönüş noktası
// Akış:
// banka POST -> callback -> notify -> verify/apply -> studio redirect

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readPost(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const raw = await readRawBody(req);
  const ct = String(req.headers["content-type"] || "");

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch (_) {
      return {};
    }
  }

  const params = new URLSearchParams(raw);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function pickOid(body) {
  return String(
    body.oid ||
    body.order_id ||
    body.merchant_oid ||
    body.OrderId ||
    body.orderid ||
    ""
  ).trim();
}

function redirect303(res, to) {
  res.statusCode = 303;
  res.setHeader("Location", to);
  res.end();
  return;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return String(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  }

  if (process.env.SITE_URL) {
    return String(process.env.SITE_URL).replace(/\/$/, "");
  }

  if (process.env.APP_URL) {
    return String(process.env.APP_URL).replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${String(process.env.VERCEL_URL).replace(/\/$/, "")}`;
  }

  return "https://aivo.tr";
}

async function postNotify(base, body) {
  const res = await fetch(`${base}/api/garanti/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.GARANTI_NOTIFY_SECRET
        ? { "x-garanti-notify-secret": String(process.env.GARANTI_NOTIFY_SECRET) }
        : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  return { ok: res.ok, status: res.status, text, json };
}

async function getVerify(base, oid) {
  const res = await fetch(
    `${base}/api/garanti/verify?oid=${encodeURIComponent(oid)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  const text = await res.text().catch(() => "");
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  return { ok: res.ok, status: res.status, text, json };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await readPost(req);
    const oid = pickOid(body);
    const base = getBaseUrl();

    if (!oid) {
      return redirect303(res, `/fiyatlandirma.html?garanti=fail&reason=missing_oid`);
    }

    const notifyResult = await postNotify(base, body);

    if (!notifyResult.ok) {
      return redirect303(
        res,
        `/fiyatlandirma.html?garanti=fail&oid=${encodeURIComponent(oid)}&reason=notify_failed`
      );
    }

    const verifyResult = await getVerify(base, oid);
    const v = verifyResult.json || null;
    const returnPath =
  v && typeof v.return_path === "string" && v.return_path.startsWith("/")
    ? v.return_path
    : "/studio.v2.html";

const hashIndex = returnPath.indexOf("#");
const cleanPath = hashIndex >= 0 ? returnPath.slice(0, hashIndex) : returnPath;
const hashPart = hashIndex >= 0 ? returnPath.slice(hashIndex) : "";

const successRedirect = `${cleanPath}${cleanPath.includes("?") ? "&" : "?"}garanti=success&oid=${encodeURIComponent(oid)}${hashPart}`;
   // ✅ FORCE APPLY (kritik)
await fetch(`${base}/api/garanti/apply`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ oid }),
});
    if (
      verifyResult.ok &&
      v &&
      v.ok === true &&
      v.status === "paid" &&
      v.credit_applied === true &&
      v.invoice_created === true
    ) {
      return redirect303(
        res,
      successRedirect
      );
    }

    if (
      verifyResult.ok &&
      v &&
      v.ok === true &&
      v.status === "paid"
    ) {
      return redirect303(
        res,
       successRedirect
      );
    }

    return redirect303(
      res,
      `/fiyatlandirma.html?garanti=fail&oid=${encodeURIComponent(oid)}&reason=verify_failed`
    );
  } catch (_) {
    return redirect303(res, `/fiyatlandirma.html?garanti=fail&reason=callback_exception`);
  }
}
