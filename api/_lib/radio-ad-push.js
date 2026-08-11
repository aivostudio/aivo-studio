import admin from "firebase-admin";
import kvModule from "../_kv.js";

const kv = kvModule?.default || kvModule || {};
const getRedis = kv.getRedis;
const kvGetJson = kv.kvGetJson;

const CLAIM_TTL_SECONDS = 5 * 60;
const SENT_TTL_SECONDS = 90 * 24 * 60 * 60;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function normalizeLang(value) {
  return lower(value).startsWith("en") ? "en" : "tr";
}

function getOrigin(req) {
  const proto = clean(req.headers["x-forwarded-proto"]).split(",")[0] || "https";
  const host =
    clean(req.headers["x-forwarded-host"]).split(",")[0] ||
    clean(req.headers.host);
  return host ? `${proto}://${host}` : "https://aivo.tr";
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();

  const projectId = clean(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("missing_firebase_env");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function sentKey(finalId) {
  return `push:radioad:sent:${clean(finalId)}`;
}

function claimKey(finalId) {
  return `push:radioad:claim:${clean(finalId)}`;
}

async function findIosTokens(user, project) {
  const targets = new Set(
    [user?.userId, user?.email, project?.userId]
      .map(lower)
      .filter(Boolean)
  );

  if (!targets.size || typeof kvGetJson !== "function") return [];

  const all = await kvGetJson("push:tokens:all");
  const tokens = Array.isArray(all) ? all.map(clean).filter(Boolean) : [];
  const matched = [];

  for (const token of tokens) {
    const record = await kvGetJson(`push:token:${token}`);
    if (!record || typeof record !== "object") continue;

    const platform = lower(record.platform);
    const permission = lower(record.permission_status);
    const revokedAt = clean(record.revoked_at);
    const recordUser = lower(record.user_id || record.user_uuid || record.email);

    if (platform !== "ios") continue;
    if (permission && permission !== "granted") continue;
    if (revokedAt) continue;
    if (!targets.has(recordUser)) continue;

    matched.push({ token, lang: normalizeLang(record.lang) });
  }

  return matched;
}

function localizedCopy(lang) {
  if (lang === "en") {
    return {
      title: "Your radio ad is ready 📻",
      body: "Your AI radio ad is complete. Open AIVO to listen.",
    };
  }

  return {
    title: "Radyo reklamın hazır 📻",
    body: "AI radyo reklamın tamamlandı. Dinlemek için AIVO'yu aç.",
  };
}

async function sendOne(req, tokenRecord, project) {
  getFirebaseApp();

  const copy = localizedCopy(tokenRecord.lang);
  const imageUrl = `${getOrigin(req)}/api/push/radioad-icon`;
  const final = project?.final || {};

  return admin.messaging().send({
    token: tokenRecord.token,
    notification: {
      title: copy.title,
      body: copy.body,
      imageUrl,
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          "mutable-content": 1,
        },
      },
      fcmOptions: {
        imageUrl,
      },
    },
    data: {
      source: "aivo_generation_complete",
      app: "radioad",
      mode: "radio_ad",
      project_id: clean(project?.id),
      final_id: clean(final.id),
      audio_url: clean(final.url),
      imageUrl,
      image: imageUrl,
      click_action: "open_app",
    },
  });
}

export async function sendRadioAdReadyPush(req, user, project) {
  const finalId = clean(project?.final?.id);
  const finalUrl = clean(project?.final?.url);

  if (!finalId || !finalUrl) {
    return { ok: false, skipped: true, reason: "final_not_ready" };
  }

  if (typeof getRedis !== "function") {
    throw new Error("kv_helpers_unavailable");
  }

  const redis = getRedis();
  const alreadySent = await redis.exists(sentKey(finalId)).catch(() => 0);
  if (Number(alreadySent) > 0) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const claimId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const claim = await redis
    .set(claimKey(finalId), claimId, { nx: true, ex: CLAIM_TTL_SECONDS })
    .catch(() => null);

  if (!claim) {
    return { ok: true, skipped: true, reason: "claimed" };
  }

  try {
    const tokens = await findIosTokens(user, project);
    if (!tokens.length) {
      return { ok: false, skipped: true, reason: "no_registered_ios_token" };
    }

    const results = [];
    for (const tokenRecord of tokens) {
      try {
        const messageId = await sendOne(req, tokenRecord, project);
        results.push({ ok: true, message_id: messageId });
      } catch (error) {
        results.push({
          ok: false,
          error: clean(error?.message || error) || "send_failed",
        });
      }
    }

    const sent = results.filter((item) => item.ok).length;
    if (sent > 0) {
      await redis.set(
        sentKey(finalId),
        JSON.stringify({ sent_at: new Date().toISOString(), sent_count: sent }),
        { ex: SENT_TTL_SECONDS }
      );
      return { ok: true, sent, results };
    }

    return { ok: false, sent: 0, results };
  } finally {
    const owner = clean(await redis.get(claimKey(finalId)).catch(() => ""));
    if (owner === claimId) {
      await redis.del(claimKey(finalId)).catch(() => null);
    }
  }
}
