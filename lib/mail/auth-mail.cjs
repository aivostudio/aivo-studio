"use strict";

/*
  ============================================================
  AIVO AUTH MAIL
  ------------------------------------------------------------
  Tek otorite:
  - E-posta doğrulama
  - Şifre sıfırlama
  - Şifre değişikliği güvenlik bildirimi

  Desteklenen diller:
  - tr
  - en

  Bu dosya CommonJS kullanır.
  Böylece hem ESM API dosyalarından import edilebilir,
  hem de CommonJS API dosyalarından require edilebilir.
  ============================================================
*/

const DEFAULT_FROM =
  "AIVO <noreply@aivo.tr>";

const DEFAULT_APP_BASE_URL =
  "https://aivo.tr";


/* ============================================================
   ENV
   ============================================================ */

function env(key, fallback = "") {
  return String(
    process.env[key] || fallback
  ).trim();
}


/* ============================================================
   LANGUAGE
   ============================================================ */

function normalizeLang(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (
    raw === "en" ||
    raw.startsWith("en-") ||
    raw.startsWith("en_")
  ) {
    return "en";
  }

  return "tr";
}


/* ============================================================
   SECURITY HELPERS
   ============================================================ */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function safeHttpUrl(value, fallback) {
  const safeFallback =
    String(
      fallback ||
      DEFAULT_APP_BASE_URL
    ).trim();

  try {
    const parsed =
      new URL(
        String(value || "").trim(),
        DEFAULT_APP_BASE_URL
      );

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return safeFallback;
    }

    return parsed.toString();
  } catch (_) {
    return safeFallback;
  }
}


function cleanRecipient(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function cleanName(value) {
  return String(value || "")
    .trim()
    .slice(0, 120);
}


/* ============================================================
   MAIL COPY
   ============================================================ */

const COPY = {
  tr: {
    common: {
      brand: "AIVO Studio",

      footer:
        "Bu e-posta AIVO Studio hesabınla ilgili güvenlik işlemi nedeniyle gönderildi.",

      copyright:
        "© AIVO Studio. Tüm hakları saklıdır.",

      supportLabel:
        "Destek Merkezi",

      supportNote:
        "Yardıma ihtiyacın varsa AIVO destek ekibiyle iletişime geçebilirsin."
    },

    verification: {
      subject:
        "AIVO • E-posta Adresini Doğrula",

      preheader:
        "AIVO Studio hesabını etkinleştirmek için e-posta adresini doğrula.",

      eyebrow:
        "HESAP DOĞRULAMA",

      title:
        "E-posta adresini doğrula",

      intro(name) {
        if (name) {
          return (
            `Merhaba ${name}, AIVO Studio hesabını ` +
            "etkinleştirmek için aşağıdaki butona tıkla."
          );
        }

        return (
          "AIVO Studio hesabını etkinleştirmek için " +
          "aşağıdaki butona tıkla."
        );
      },

      button:
        "E-postamı Doğrula",

      detail:
        "Bu doğrulama bağlantısı 1 saat boyunca geçerlidir.",

      fallback:
        "Buton çalışmazsa aşağıdaki bağlantıyı tarayıcına yapıştır:",

      security:
        "Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma."
    },

    passwordReset: {
      subject:
        "AIVO • Şifre Sıfırlama",

      preheader:
        "AIVO Studio şifreni güvenli şekilde sıfırla.",

      eyebrow:
        "ŞİFRE SIFIRLAMA",

      title:
        "Şifreni sıfırla",

      intro:
        "AIVO Studio hesabın için bir şifre sıfırlama isteği aldık.",

      button:
        "Şifremi Sıfırla",

      detail:
        "Bu şifre sıfırlama bağlantısı 30 dakika boyunca geçerlidir.",

      fallback:
        "Buton çalışmazsa aşağıdaki bağlantıyı tarayıcına yapıştır:",

      security:
        "Bu isteği sen yapmadıysan şifren değişmez. Bu e-postayı güvenle silebilirsin."
    },

    passwordChanged: {
      subject:
        "AIVO • Şifren Değiştirildi",

      preheader:
        "AIVO Studio hesap şifren başarıyla değiştirildi.",

      eyebrow:
        "GÜVENLİK BİLDİRİMİ",

      title:
        "Şifren başarıyla değiştirildi",

      intro:
        "AIVO Studio hesabının şifresi başarıyla güncellendi.",

      detail:
        "Bu işlemi sen yaptıysan başka bir işlem yapmana gerek yok.",

      security:
        "Bu işlemi sen yapmadıysan hesabını korumak için hemen AIVO destek ekibiyle iletişime geç.",

      button:
        "Destek Ekibiyle İletişime Geç"
    }
  },


  en: {
    common: {
      brand: "AIVO Studio",

      footer:
        "This email was sent because of a security action involving your AIVO Studio account.",

      copyright:
        "© AIVO Studio. All rights reserved.",

      supportLabel:
        "Support Center",

      supportNote:
        "Contact the AIVO support team if you need assistance."
    },

    verification: {
      subject:
        "AIVO • Verify Your Email Address",

      preheader:
        "Verify your email address to activate your AIVO Studio account.",

      eyebrow:
        "ACCOUNT VERIFICATION",

      title:
        "Verify your email address",

      intro(name) {
        if (name) {
          return (
            `Hello ${name}, click the button below ` +
            "to activate your AIVO Studio account."
          );
        }

        return (
          "Click the button below to activate " +
          "your AIVO Studio account."
        );
      },

      button:
        "Verify My Email",

      detail:
        "This verification link is valid for 1 hour.",

      fallback:
        "If the button does not work, paste the following link into your browser:",

      security:
        "If you did not create this account, you can safely ignore this email."
    },

    passwordReset: {
      subject:
        "AIVO • Reset Your Password",

      preheader:
        "Securely reset your AIVO Studio password.",

      eyebrow:
        "PASSWORD RESET",

      title:
        "Reset your password",

      intro:
        "We received a password reset request for your AIVO Studio account.",

      button:
        "Reset My Password",

      detail:
        "This password reset link is valid for 30 minutes.",

      fallback:
        "If the button does not work, paste the following link into your browser:",

      security:
        "If you did not request a password reset, your password will not be changed. You can safely ignore this email."
    },

    passwordChanged: {
      subject:
        "AIVO • Your Password Was Changed",

      preheader:
        "Your AIVO Studio account password was successfully changed.",

      eyebrow:
        "SECURITY NOTICE",

      title:
        "Your password was changed",

      intro:
        "The password for your AIVO Studio account was successfully updated.",

      detail:
        "No further action is required if you made this change.",

      security:
        "If you did not make this change, contact the AIVO support team immediately to protect your account.",

      button:
        "Contact Support"
    }
  }
};


/* ============================================================
   HTML TEMPLATE
   ============================================================ */

function renderMail({
  lang,
  subject,
  preheader,
  eyebrow,
  title,
  intro,
  buttonLabel,
  actionUrl,
  detail,
  fallback,
  security
}) {
  const language =
    normalizeLang(lang);

  const common =
    COPY[language].common;

  const appBaseUrl =
    safeHttpUrl(
      env(
        "APP_BASE_URL",
        DEFAULT_APP_BASE_URL
      ),
      DEFAULT_APP_BASE_URL
    );

  const supportUrl =
    safeHttpUrl(
      `${appBaseUrl.replace(/\/+$/, "")}/kurumsal/iletisim.html`,
      `${DEFAULT_APP_BASE_URL}/kurumsal/iletisim.html`
    );

  const safeActionUrl =
    actionUrl
      ? safeHttpUrl(
          actionUrl,
          appBaseUrl
        )
      : "";

  const hasAction =
    Boolean(
      buttonLabel &&
      safeActionUrl
    );

  const direction = "ltr";

  return `
<!doctype html>
<html lang="${escapeHtml(language)}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>${escapeHtml(subject)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#070914;
    color:#f7f7fb;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
  "
>
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    "
  >
    ${escapeHtml(preheader)}
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
      width:100%;
      background:#070914;
    "
  >
    <tr>
      <td
        align="center"
        style="
          padding:32px 16px;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width:100%;
            max-width:620px;
          "
        >
          <tr>
            <td
              style="
                padding:0 0 18px;
                font-size:22px;
                font-weight:800;
                letter-spacing:.2px;
                color:#ffffff;
              "
            >
              <span style="color:#22d3ee;">A</span><span style="color:#8b5cf6;">I</span><span style="color:#ec4899;">V</span><span style="color:#ffffff;">O</span>
              <span
                style="
                  margin-left:6px;
                  color:#ffffff;
                "
              >
                Studio
              </span>
            </td>
          </tr>

          <tr>
            <td
              style="
                border:1px solid rgba(255,255,255,.14);
                border-radius:24px;
                background:#11132a;
                overflow:hidden;
              "
            >
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>
                  <td
                    style="
                      height:5px;
                      background:
                        linear-gradient(
                          90deg,
                          #22d3ee,
                          #7c3aed,
                          #ec4899
                        );
                    "
                  ></td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:
                        38px
                        38px
                        12px;
                    "
                  >
                    <div
                      style="
                        margin-bottom:14px;
                        color:#a78bfa;
                        font-size:12px;
                        font-weight:800;
                        letter-spacing:1.4px;
                      "
                    >
                      ${escapeHtml(eyebrow)}
                    </div>

                    <h1
                      style="
                        margin:0;
                        color:#ffffff;
                        font-size:30px;
                        line-height:1.18;
                      "
                    >
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:
                        10px
                        38px
                        0;
                      color:#d7d7e4;
                      font-size:16px;
                      line-height:1.7;
                    "
                  >
                    ${escapeHtml(intro)}
                  </td>
                </tr>

                ${
                  hasAction
                    ? `
                <tr>
                  <td
                    style="
                      padding:
                        28px
                        38px
                        10px;
                    "
                  >
                    <a
                      href="${escapeHtml(safeActionUrl)}"
                      target="_blank"
                      rel="noopener"
                      style="
                        display:inline-block;
                        padding:14px 22px;
                        border-radius:12px;
                        background:
                          linear-gradient(
                            135deg,
                            #7c3aed,
                            #2563eb
                          );
                        color:#ffffff;
                        font-size:15px;
                        font-weight:800;
                        text-decoration:none;
                        box-shadow:
                          0 12px 30px
                          rgba(79,70,229,.30);
                      "
                    >
                      ${escapeHtml(buttonLabel)}
                    </a>
                  </td>
                </tr>
                    `
                    : ""
                }

                ${
                  detail
                    ? `
                <tr>
                  <td
                    style="
                      padding:
                        18px
                        38px
                        0;
                      color:#b9b9c8;
                      font-size:14px;
                      line-height:1.6;
                    "
                  >
                    ${escapeHtml(detail)}
                  </td>
                </tr>
                    `
                    : ""
                }

                ${
                  hasAction && fallback
                    ? `
                <tr>
                  <td
                    style="
                      padding:
                        22px
                        38px
                        0;
                      color:#9292a5;
                      font-size:12px;
                      line-height:1.6;
                    "
                  >
                    <div
                      style="
                        margin-bottom:7px;
                      "
                    >
                      ${escapeHtml(fallback)}
                    </div>

                    <div
                      style="
                        padding:12px;
                        border-radius:10px;
                        background:#090b18;
                        color:#93c5fd;
                        word-break:break-all;
                      "
                    >
                      ${escapeHtml(safeActionUrl)}
                    </div>
                  </td>
                </tr>
                    `
                    : ""
                }

                ${
                  security
                    ? `
                <tr>
                  <td
                    style="
                      padding:
                        24px
                        38px
                        32px;
                    "
                  >
                    <div
                      style="
                        padding:15px 16px;
                        border:1px solid
                          rgba(167,139,250,.22);
                        border-radius:12px;
                        background:
                          rgba(124,58,237,.08);
                        color:#cfcfe0;
                        font-size:13px;
                        line-height:1.6;
                      "
                    >
                      ${escapeHtml(security)}
                    </div>
                  </td>
                </tr>
                    `
                    : ""
                }
              </table>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:
                  22px
                  8px
                  0;
                color:#7f7f92;
                font-size:11px;
                line-height:1.6;
                text-align:center;
              "
            >
              <div>
                ${escapeHtml(common.footer)}
              </div>

              <div
                style="
                  margin-top:8px;
                "
              >
                <a
                  href="${escapeHtml(supportUrl)}"
                  target="_blank"
                  rel="noopener"
                  style="
                    color:#a78bfa;
                    text-decoration:none;
                  "
                >
                  ${escapeHtml(common.supportLabel)}
                </a>
              </div>

              <div
                style="
                  margin-top:8px;
                "
              >
                ${escapeHtml(common.copyright)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}


/* ============================================================
   PLAIN TEXT TEMPLATE
   ============================================================ */

function renderPlainText({
  subject,
  intro,
  buttonLabel,
  actionUrl,
  detail,
  fallback,
  security
}) {
  const lines = [
    subject,
    "",
    intro
  ];

  if (
    buttonLabel &&
    actionUrl
  ) {
    lines.push(
      "",
      `${buttonLabel}:`,
      actionUrl
    );
  }

  if (detail) {
    lines.push(
      "",
      detail
    );
  }

  if (
    fallback &&
    actionUrl
  ) {
    lines.push(
      "",
      fallback,
      actionUrl
    );
  }

  if (security) {
    lines.push(
      "",
      security
    );
  }

  lines.push(
    "",
    "AIVO Studio",
    DEFAULT_APP_BASE_URL
  );

  return lines.join("\n");
}


/* ============================================================
   BUILD: VERIFICATION EMAIL
   ============================================================ */

function buildVerificationEmail({
  lang,
  verifyUrl,
  name
}) {
  const language =
    normalizeLang(lang);

  const copy =
    COPY[language].verification;

  const recipientName =
    cleanName(name);

  const intro =
    copy.intro(recipientName);

  const actionUrl =
    safeHttpUrl(
      verifyUrl,
      DEFAULT_APP_BASE_URL
    );

  return {
    lang: language,
    subject: copy.subject,

    html: renderMail({
      lang: language,
      subject: copy.subject,
      preheader: copy.preheader,
      eyebrow: copy.eyebrow,
      title: copy.title,
      intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: copy.fallback,
      security: copy.security
    }),

    text: renderPlainText({
      subject: copy.subject,
      intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: copy.fallback,
      security: copy.security
    })
  };
}


/* ============================================================
   BUILD: PASSWORD RESET EMAIL
   ============================================================ */

function buildPasswordResetEmail({
  lang,
  resetUrl
}) {
  const language =
    normalizeLang(lang);

  const copy =
    COPY[language].passwordReset;

  const actionUrl =
    safeHttpUrl(
      resetUrl,
      DEFAULT_APP_BASE_URL
    );

  return {
    lang: language,
    subject: copy.subject,

    html: renderMail({
      lang: language,
      subject: copy.subject,
      preheader: copy.preheader,
      eyebrow: copy.eyebrow,
      title: copy.title,
      intro: copy.intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: copy.fallback,
      security: copy.security
    }),

    text: renderPlainText({
      subject: copy.subject,
      intro: copy.intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: copy.fallback,
      security: copy.security
    })
  };
}


/* ============================================================
   BUILD: PASSWORD CHANGED EMAIL
   ============================================================ */

function buildPasswordChangedEmail({
  lang,
  supportUrl
}) {
  const language =
    normalizeLang(lang);

  const copy =
    COPY[language].passwordChanged;

  const appBaseUrl =
    safeHttpUrl(
      env(
        "APP_BASE_URL",
        DEFAULT_APP_BASE_URL
      ),
      DEFAULT_APP_BASE_URL
    );

  const actionUrl =
    safeHttpUrl(
      supportUrl ||
        `${appBaseUrl.replace(/\/+$/, "")}/kurumsal/iletisim.html`,
      `${DEFAULT_APP_BASE_URL}/kurumsal/iletisim.html`
    );

  return {
    lang: language,
    subject: copy.subject,

    html: renderMail({
      lang: language,
      subject: copy.subject,
      preheader: copy.preheader,
      eyebrow: copy.eyebrow,
      title: copy.title,
      intro: copy.intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: "",
      security: copy.security
    }),

    text: renderPlainText({
      subject: copy.subject,
      intro: copy.intro,
      buttonLabel: copy.button,
      actionUrl,
      detail: copy.detail,
      fallback: "",
      security: copy.security
    })
  };
}


/* ============================================================
   RESEND
   ============================================================ */

async function sendAuthEmail({
  to,
  mail
}) {
  const recipient =
    cleanRecipient(to);

  if (
    !recipient ||
    !recipient.includes("@")
  ) {
    return {
      sent: false,
      reason: "invalid_recipient"
    };
  }

  if (
    !mail ||
    !mail.subject ||
    !mail.html
  ) {
    return {
      sent: false,
      reason: "invalid_mail_payload"
    };
  }

  const apiKey =
    env("RESEND_API_KEY");

  if (!apiKey) {
    return {
      sent: false,
      reason: "missing_resend_api_key"
    };
  }

  const from =
    env(
      "MAIL_FROM",
      DEFAULT_FROM
    );

  try {
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            from,
            to: recipient,
            subject: mail.subject,
            html: mail.html,
            text: mail.text || ""
          })
        }
      );

    const responseText =
      await response
        .text()
        .catch(function () {
          return "";
        });

    if (!response.ok) {
      return {
        sent: false,
        reason: "resend_failed",
        status: response.status,
        detail: responseText
      };
    }

    let responseData = {};

    try {
      responseData =
        responseText
          ? JSON.parse(responseText)
          : {};
    } catch (_) {
      responseData = {};
    }

    return {
      sent: true,
      id: responseData.id || ""
    };
  } catch (error) {
    return {
      sent: false,
      reason: "resend_error",
      detail:
        error &&
        error.message
          ? error.message
          : String(error)
    };
  }
}


/* ============================================================
   DIRECT SEND HELPERS
   ============================================================ */

async function sendVerificationEmail({
  to,
  lang,
  verifyUrl,
  name
}) {
  const mail =
    buildVerificationEmail({
      lang,
      verifyUrl,
      name
    });

  return sendAuthEmail({
    to,
    mail
  });
}


async function sendPasswordResetEmail({
  to,
  lang,
  resetUrl
}) {
  const mail =
    buildPasswordResetEmail({
      lang,
      resetUrl
    });

  return sendAuthEmail({
    to,
    mail
  });
}


async function sendPasswordChangedEmail({
  to,
  lang,
  supportUrl
}) {
  const mail =
    buildPasswordChangedEmail({
      lang,
      supportUrl
    });

  return sendAuthEmail({
    to,
    mail
  });
}


/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  normalizeLang,

  buildVerificationEmail,
  buildPasswordResetEmail,
  buildPasswordChangedEmail,

  sendAuthEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};
