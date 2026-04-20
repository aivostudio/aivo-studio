import crypto from "node:crypto";
import kvMod from "../_kv.js";

// /api/garanti/init.js
// Garanti ödeme başlangıcı
// Amaç: fiyatlandırmadan gelen POST'u al, order_init + order KV kaydı yaz,
// frontend'e Garanti 3D/OOS yönlendirme alanları dön

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function getSiteBase() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "https://aivo.tr";

  return String(raw).replace(/\/$/, "");
}

function sha1Upper(value) {
  return crypto.createHash("sha1").update(String(value), "utf8").digest("hex").toUpperCase();
}

function getClientIp(req) {
  return (
    String(
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      ""
    )
      .split(",")[0]
      .trim() || "127.0.0.1"
  );
}

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};
  const kvSetJson = kv.kvSetJson;

  if (typeof kvSetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvSetJson");
  }

  return { kvSetJson };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  let body = null;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (_) {
    return json(res, 400, { ok: false, error: "BODY_JSON_INVALID" });
  }

  const user_id = String(body.user_id || "").trim();
  const email = normEmail(body.email);
  const plan = String(body.plan || "").trim().toLowerCase();

  if (!user_id || !email) {
    return json(res, 400, {
      ok: false,
      error: "BODY_MISSING_FIELDS",
      need: ["user_id", "email"],
    });
  }

  const PLAN_CATALOG = {
    baslangic: { plan: "baslangic", amount: 199, credits: 25 },
    standart: { plan: "standart", amount: 699, credits: 100 },
    pro: { plan: "pro", amount: 1299, credits: 200 },
    studyo: { plan: "studyo", amount: 2999, credits: 500 },
  };

  const selectedPlan = PLAN_CATALOG[plan];

  if (!selectedPlan) {
    return json(res, 400, {
      ok: false,
      error: "PLAN_INVALID",
      allowed: Object.keys(PLAN_CATALOG),
    });
  }

  const amount = selectedPlan.amount;
  const credits = selectedPlan.credits;

  const oid = `GARANTI_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const now = new Date().toISOString();
  const siteBase = getSiteBase();

  const okUrl = siteBase
    ? `${siteBase}/api/garanti/callback`
    : `/api/garanti/callback`;

  const failUrl = siteBase
    ? `${siteBase}/api/garanti/callback`
    : `/api/garanti/callback`;

  const garanti3dUrl = String(
    process.env.GARANTI_3D_URL ||
      process.env.GARANTI_3D_GATEWAY_URL ||
      "https://sanalposprov.garanti.com.tr/servlet/gt3dengine"
  ).trim();

  const garantiMode = String(process.env.GARANTI_MODE || "PROD").trim().toUpperCase();
  const garanti3dModel = String(process.env.GARANTI_3D_MODEL || "3D_OOS_PAY").trim();
  const garantiApiVersion = String(process.env.GARANTI_API_VERSION || "v0.01").trim();

  const garantiMerchantId = String(process.env.GARANTI_MERCHANT_ID || "").trim();
  const garantiTerminalId = String(process.env.GARANTI_TERMINAL_ID || "").trim();
  const garantiTerminalUserId = String(process.env.GARANTI_TERMINAL_USER_ID || "").trim();
  const garantiProvisionUserId = String(process.env.GARANTI_PROVISION_USER_ID || "").trim();
  const garantiStoreKey = String(process.env.GARANTI_STORE_KEY || "").trim();
  const garanti3dSecureKey = String(process.env.GARANTI_3D_SECURE_KEY || "").trim();
  const garantiProvisionPassword = String(
    process.env.GARANTI_PROVISION_PASSWORD ||
      process.env.GARANTI_PASSWORD ||
      ""
  ).trim();

  const missingConfig = [
    !garanti3dUrl && "GARANTI_3D_URL",
    !garantiMerchantId && "GARANTI_MERCHANT_ID",
    !garantiTerminalId && "GARANTI_TERMINAL_ID",
    !garantiTerminalUserId && "GARANTI_TERMINAL_USER_ID",
    !garantiProvisionUserId && "GARANTI_PROVISION_USER_ID",
    !garantiStoreKey && "GARANTI_STORE_KEY",
    !garanti3dSecureKey && "GARANTI_3D_SECURE_KEY",
    !garantiProvisionPassword && "GARANTI_PROVISION_PASSWORD",
  ].filter(Boolean);

  try {
    const { kvSetJson } = resolveKv();

    await kvSetJson(
      `aivo:garanti:order_init:${oid}`,
      {
        oid,
        email,
        user_id,
        plan,
        amount,
        credits,
        currency: "TRY",
        provider: "garanti",
        status: "init",
        ok_url: okUrl,
        fail_url: failUrl,
        gateway_url: garanti3dUrl || null,
        created_at: now,
      },
      { ex: 60 * 60 * 24 }
    );

    await kvSetJson(
      `aivo:garanti:order:${oid}`,
      {
        oid,
        email,
        user_id,
        plan,
        amount,
        credits,
        currency: "TRY",
        provider: "garanti",
        status: "pending",
        created_at: now,
      },
      { ex: 60 * 60 * 24 }
    );
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "KV_WRITE_FAILED",
      detail: String(e?.message || e),
    });
  }

  if (missingConfig.length) {
    return json(res, 503, {
      ok: false,
      error: "GARANTI_3D_CONFIG_MISSING",
      oid,
      missing: missingConfig,
      note: "Garanti OOS/3D formu olusturulamadi. Env alanlari eksik.",
    });
  }

  const amountMinor = Math.round(amount * 100);
  const installmentCount = "";
  const terminalIdPadded = String(garantiTerminalId).padStart(9, "0");

  const hashedPassword = sha1Upper(`${garantiProvisionPassword}${terminalIdPadded}`);

  const securityData = [
    garantiTerminalId,
    oid,
    String(amountMinor),
    okUrl,
    failUrl,
    "sales",
    installmentCount,
    garantiStoreKey,
    hashedPassword,
  ].join("");

  const secure3dhash = sha1Upper(securityData);

  const txntimestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const customerIpAddress = getClientIp(req);

  return json(res, 200, {
    ok: true,
    oid,
    provider: "garanti",
    gateway: {
      mode: "3d_form",
      action: garanti3dUrl,
      method: "POST",
      fields: {
        mode: garantiMode,
        apiversion: garantiApiVersion,
        secure3dsecuritylevel: garanti3dModel,
        terminalprovuserid: garantiProvisionUserId,
        terminaluserid: garantiTerminalUserId,
        terminalid: garantiTerminalId,
        terminalmerchantid: garantiMerchantId,
        orderid: oid,
        txntype: "sales",
        txnamount: String(amountMinor),
        txncurrencycode: "949",
        txninstallmentcount: installmentCount,
        successurl: okUrl,
        errorurl: failUrl,
        customeremailaddress: email,
        customeripaddress: customerIpAddress,
        companyname: "AIVO",
        lang: "TR",
        txntimestamp,
        secure3dhash,
      },
    },
  });
}
