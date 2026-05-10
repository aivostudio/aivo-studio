// /api/garanti/notify.js
// Garanti bildirim/callback endpoint'i
// Gerçek banka hash doğrulaması ile ödeme sonucunu işler
// TEK SOURCE OF TRUTH: api/_kv.js kullanır

import crypto from "crypto";
import kvMod from "../_kv.js";

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};

  const kvGet = kv.kvGet;
  const kvSetJson = kv.kvSetJson;

  if (typeof kvGet !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGet");
  }
  if (typeof kvSetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvSetJson");
  }

  return { kvGet, kvSetJson };
}

function tryJsonParse(x) {
  if (x == null) return null;
  if (typeof x === "object") return x;

  try {
    return JSON.parse(String(x));
  } catch (_) {
    return x;
  }
}

async function readRawBody(req) {
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

function pickOid(post) {
  return String(
    post.oid ||
      post.order_id ||
      post.merchant_oid ||
      post.OrderId ||
      post.orderid ||
      ""
  ).trim();
}

function pickAmount(post, initData) {
  const raw =
    post.txnamount ||
    post.amount ||
    post.toplam ||
    post.total_amount ||
    initData?.amount ||
    null;

  if (raw == null || raw === "") return null;

  const normalized = String(raw).replace(",", ".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function redirectToCheckout(res, state, oid) {
  const qs = new URLSearchParams();
  qs.set("garanti", state);
  if (oid) qs.set("oid", oid);

  res.statusCode = 303;
  res.setHeader("Location", `/checkout.html?${qs.toString()}`);
  res.end();
  return;
}

function garantiHashVerify(post) {
  const incomingHash = String(post.hash || "").trim();
  const responseHashparams = String(post.hashparams || "").trim();
  const storeKey = String(process.env.GARANTI_STORE_KEY || "").trim();

  if (!incomingHash || !responseHashparams || !storeKey) {
    return false;
  }

  const paramList = responseHashparams.split(":").filter(Boolean);
  let digestData = "";

  for (const param of paramList) {
    const rawKey = String(param || "").trim();
    const keyLower = rawKey.toLowerCase();

    let value = "";
    if (post[rawKey] != null) value = String(post[rawKey]);
    else if (post[keyLower] != null) value = String(post[keyLower]);

    digestData += value;
  }

  digestData += storeKey;

  const calculatedHash = crypto
    .createHash("sha1")
    .update(digestData, "utf8")
    .digest("base64");

  return calculatedHash === incomingHash;
}

function isApprovedByBank(post) {
  const procReturnCode = String(
    post.procreturncode || post.procreturncode || ""
  ).trim();

  return procReturnCode === "00";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { kvGet, kvSetJson } = resolveKv();

    const post = await readPost(req);
    const oid = pickOid(post);

    if (!oid) {
      return res.status(400).send("MISSING_OID");
    }

    const orderKey = `aivo:garanti:order:${oid}`;
    const initKey = `aivo:garanti:order_init:${oid}`;

    const existingRaw = await kvGet(orderKey);
    const initRaw = await kvGet(initKey);

    const existing = tryJsonParse(existingRaw) || {};
    const initData = tryJsonParse(initRaw) || {};

    const now = new Date().toISOString();
    const hashValid = garantiHashVerify(post);
    const approved = isApprovedByBank(post);
    const status = hashValid && approved ? "paid" : "failed";
    const amount = pickAmount(post, initData);

    const record = {
      oid,
      provider: "garanti",
      status,
      total_amount: amount,
      currency: initData?.currency || existing?.currency || "TRY",
      plan: initData?.plan || existing?.plan || null,
      credits: initData?.credits || existing?.credits || null,
      amount: initData?.amount || existing?.amount || amount || null,
      email: initData?.email || existing?.email || null,
      user_id: initData?.user_id || existing?.user_id || null,
      created_at: existing?.created_at || initData?.created_at || now,
      updated_at: now,
      paid_at: status === "paid" ? now : existing?.paid_at || null,
      credit_applied: existing?.credit_applied || false,
      invoice_created: existing?.invoice_created || false,
     invoice_id: existing?.invoice_id || null,
     return_path:
     typeof existing?.return_path === "string" && existing.return_path.startsWith("/")
      ? existing.return_path
      : "/studio.v2.html",
      notify_payload: post,
      notify_hash_valid: hashValid,
      notify_proc_return_code: String(
        post.procreturncode || post.procreturncode || ""
      ),
      notify_authcode: String(post.authcode || ""),
      notify_errmsg: String(post.errmsg || ""),
    };

    await kvSetJson(orderKey, record, { ex: 60 * 60 * 24 * 30 });

    if (status === "paid") {
      return redirectToCheckout(res, "ok", oid);
    }

    return redirectToCheckout(res, "fail", oid);
  } catch (e) {
    return redirectToCheckout(res, "fail", "");
  }
}
