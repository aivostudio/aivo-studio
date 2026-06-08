// /api/admin/mail/send-campaign.js
import { Resend } from "resend";

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(String(email || "").trim().toLowerCase());
}

function esc(value = "") {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanEmail(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const mailMatch = raw.match(/mailto:([^)\s]+)/i);
  if (mailMatch && mailMatch[1]) return mailMatch[1].trim().toLowerCase();

  const bracketMatch = raw.match(/\[([^\]]+@[^\]]+)\]/i);
  if (bracketMatch && bracketMatch[1]) return bracketMatch[1].trim().toLowerCase();

  return raw;
}

function isEmailLike(value) {
  const email = cleanEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normLang(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "en" || raw.startsWith("en-") || raw.includes("english")) {
    return "en";
  }

  if (raw === "tr" || raw.startsWith("tr-") || raw.includes("turkish")) {
    return "tr";
  }

  return "tr";
}

function pickLang(user) {
  return normLang(
    user?.lang ||
      user?.language ||
      user?.locale ||
      user?.appLang ||
      user?.app_lang ||
      user?.deviceLang ||
      user?.device_lang ||
      "tr"
  );
}

function campaignHtml({ title, message, lang }) {
  const logoUrl = "https://aivo.tr/aivo-logo.png";
  const safeTitle = esc(title);
  const safeMessage = esc(message).replace(/\n/g, "<br/>");

  const footerText =
    lang === "en"
      ? "You are receiving this email because you have an AIVO Studio account."
      : "Bu e-postayı AIVO Studio hesabınız olduğu için alıyorsunuz.";

  const ctaText = lang === "en" ? "Open AIVO Studio" : "AIVO Studio'yu Aç";
  const siteUrl = "https://aivo.tr/";

  return `<!doctype html>
<html lang="${lang === "en" ? "en" : "tr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;background:#070A14;color:#E7ECFF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${safeTitle}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070A14;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0"
          style="width:100%;max-width:680px;border-radius:22px;overflow:hidden;border:1px solid rgba(120,120,255,.20);background:linear-gradient(180deg,rgba(18,22,38,.96),rgba(8,10,20,.98));box-shadow:0 20px 70px rgba(0,0,0,.45);">
          
          <tr>
            <td style="padding:24px 22px 12px;">
              <img src="${logoUrl}" width="112" alt="AIVO" style="display:block;max-width:112px;height:auto;margin-bottom:18px;" />

              <div style="font-size:26px;line-height:1.2;font-weight:900;margin:0 0 12px;color:#ffffff;">
                ${safeTitle}
              </div>

              <div style="font-size:15px;line-height:1.75;color:#dce4ff;opacity:.94;">
                ${safeMessage}
              </div>

              <div style="height:22px;"></div>

              <a href="${siteUrl}"
                style="display:inline-block;text-decoration:none;background:linear-gradient(135deg,#7c5cff,#ff3fc8);color:#fff;font-weight:800;border-radius:14px;padding:13px 18px;">
                ${ctaText}
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 22px 22px;">
              <div style="border-top:1px solid rgba(255,255,255,.10);padding-top:14px;font-size:12px;line-height:1.55;color:#aeb8d8;">
                ${esc(footerText)}<br/>
                © ${new Date().getFullYear()} AIVO Studio • aivo.tr
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function campaignText({ title, message, lang }) {
  const footer =
    lang === "en"
      ? "You are receiving this email because you have an AIVO Studio account."
      : "Bu e-postayı AIVO Studio hesabınız olduğu için alıyorsunuz.";

  return `${title}\n\n${message}\n\n${footer}\nhttps://aivo.tr/`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectUsers() {
  const kvmod = await import("../../_kv.js");
  const kv = kvmod.default || kvmod;

  if (!kv || typeof kv.getRedis !== "function" || typeof kv.kvGetJson !== "function") {
    throw new Error("kv_helpers_missing");
  }

  const redis = kv.getRedis();
  const byEmail = new Map();

  function addUser(u, fallbackEmail = "") {
    const email = cleanEmail(u?.email || fallbackEmail || "");
    if (!email || !isEmailLike(email)) return;

    const prev = byEmail.get(email) || {};
    byEmail.set(email, {
      ...prev,
      ...u,
      email,
      role: u?.role || prev.role || "user",
      lang: pickLang(u || prev),
      disabled: Boolean(u?.disabled || prev.disabled || false),
      unsubscribed: Boolean(
        u?.unsubscribed ||
          u?.emailUnsubscribed ||
          u?.mailUnsubscribed ||
          u?.marketingUnsubscribed ||
          prev.unsubscribed ||
          false
      ),
    });
  }

  const list = await kv.kvGetJson("users:list").catch(() => []);
  if (Array.isArray(list)) {
    for (const u of list) addUser(u);
  }

  async function scanPattern(pattern) {
    let cursor = 0;

    do {
      const resp = await redis.scan(cursor, { match: pattern, count: 1000 });

      let nextCursor = 0;
      let keys = [];

      if (Array.isArray(resp)) {
        nextCursor = Number(resp[0]) || 0;
        keys = Array.isArray(resp[1]) ? resp[1] : [];
      } else {
        nextCursor = Number(resp?.cursor) || 0;
        keys = Array.isArray(resp?.keys) ? resp.keys : [];
      }

      for (const key of keys) {
        const u = await kv.kvGetJson(key).catch(() => null);
        if (!u) continue;

        const fallbackEmail = String(key)
          .replace(/^user:/, "")
          .replace(/^users:/, "");

        addUser(u, fallbackEmail);
      }

      cursor = nextCursor;
    } while (cursor !== 0 && byEmail.size < 10000);
  }

  await scanPattern("user:*");
  await scanPattern("users:*");

  return Array.from(byEmail.values())
    .filter((u) => u && isEmailLike(u.email))
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: "RESEND_API_KEY_missing" });
    }

    const body = req.body || {};
    const admin = String(body.admin || body.email || "").trim().toLowerCase();

    if (!admin) {
      return res.status(401).json({ ok: false, error: "admin_required" });
    }

    if (!isAdminEmail(admin)) {
      return res.status(403).json({ ok: false, error: "admin_forbidden" });
    }

    const subjectTr = String(body.subjectTr || body.titleTr || "").trim();
    const messageTr = String(body.messageTr || "").trim();
    const subjectEn = String(body.subjectEn || body.titleEn || "").trim();
    const messageEn = String(body.messageEn || "").trim();

    const testOnly = Boolean(body.testOnly);
    const testEmail = cleanEmail(body.testEmail || "");
    const offset = Math.max(0, Number(body.offset || 0) || 0);
    const limitRaw = Math.max(1, Number(body.limit || 80) || 80);
    const limit = Math.min(limitRaw, 120);

    const hasTr = Boolean(subjectTr && messageTr);
    const hasEn = Boolean(subjectEn && messageEn);

    if (!hasTr && !hasEn) {
      return res.status(400).json({
        ok: false,
        error: "at_least_one_language_required",
      });
    }

    if ((subjectTr && !messageTr) || (!subjectTr && messageTr)) {
      return res.status(400).json({
        ok: false,
        error: "tr_subject_and_message_required_together",
      });
    }

    if ((subjectEn && !messageEn) || (!subjectEn && messageEn)) {
      return res.status(400).json({
        ok: false,
        error: "en_subject_and_message_required_together",
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddr = "AIVO Studio <no-reply@mail.aivo.tr>";
    const replyTo = "info@aivo.tr";

    let users = [];

    if (testOnly) {
      if (!isEmailLike(testEmail)) {
        return res.status(400).json({ ok: false, error: "test_email_invalid" });
      }

      users = [
        {
          email: testEmail,
          lang: hasEn ? "en" : "tr",
          role: "test",
          disabled: false,
          unsubscribed: false,
        },
      ];
    } else {
      const allUsers = await collectUsers();

      users = allUsers
        .filter((u) => !u.disabled)
        .filter((u) => !u.unsubscribed)
        .slice(offset, offset + limit);
    }

    const results = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let sentTr = 0;
    let sentEn = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const to = cleanEmail(user.email);

      if (!isEmailLike(to)) {
        skipped += 1;
        results.push({ email: to || null, ok: false, skipped: true, error: "email_invalid" });
        continue;
      }

      const lang = pickLang(user);

      let subject = "";
      let message = "";
      let finalLang = lang;

      if (lang === "en" && hasEn) {
        subject = subjectEn;
        message = messageEn;
        finalLang = "en";
      } else if (lang === "tr" && hasTr) {
        subject = subjectTr;
        message = messageTr;
        finalLang = "tr";
      } else if (hasTr) {
        subject = subjectTr;
        message = messageTr;
        finalLang = "tr";
      } else if (hasEn) {
        subject = subjectEn;
        message = messageEn;
        finalLang = "en";
      }

      if (!subject || !message) {
        skipped += 1;
        results.push({ email: to, ok: false, skipped: true, error: "content_missing" });
        continue;
      }

      try {
        const { data, error } = await resend.emails.send({
          from: fromAddr,
          to,
          subject,
          text: campaignText({ title: subject, message, lang: finalLang }),
          html: campaignHtml({ title: subject, message, lang: finalLang }),
          replyTo,
        });

        if (error) {
          failed += 1;
          results.push({
            email: to,
            lang: finalLang,
            ok: false,
            error,
          });
        } else {
          sent += 1;
          if (finalLang === "en") sentEn += 1;
          else sentTr += 1;

          results.push({
            email: to,
            lang: finalLang,
            ok: true,
            id: data?.id || null,
          });
        }
      } catch (err) {
        failed += 1;
        results.push({
          email: to,
          lang: finalLang,
          ok: false,
          error: err?.message || String(err),
        });
      }

      if (i > 0 && i % 10 === 0) {
        await sleep(350);
      }
    }

    return res.status(200).json({
      ok: true,
      testOnly,
      offset,
      limit,
      processed: users.length,
      sent,
      sent_tr: sentTr,
      sent_en: sentEn,
      failed,
      skipped,
      has_more: !testOnly && users.length === limit,
      next_offset: !testOnly && users.length === limit ? offset + limit : null,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "mail_campaign_failed",
      message: err?.message || String(err),
    });
  }
}
