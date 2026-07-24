// api/auth/forgot.js

const crypto =
  require("crypto");

const { kv } =
  require("@vercel/kv");

const kvMod =
  require("../_kv.js");

const authMail =
  require("../../lib/mail/auth-mail.cjs");


/* ============================================================
   MODULES
   ============================================================ */

const kvApi =
  kvMod?.default ||
  kvMod ||
  {};

const kvGetJson =
  kvApi.kvGetJson;

const normalizeLang =
  authMail.normalizeLang;

const sendPasswordResetEmail =
  authMail.sendPasswordResetEmail;


/* ============================================================
   HELPERS
   ============================================================ */

function json(
  res,
  status,
  data
) {
  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.end(
    JSON.stringify(data)
  );
}


function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


async function readJson(req) {
  try {
    if (
      req.body &&
      typeof req.body === "object"
    ) {
      return req.body;
    }

    const rawBody =
      String(req.body || "")
        .trim();

    if (rawBody) {
      return JSON.parse(rawBody);
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    if (!chunks.length) {
      return {};
    }

    return JSON.parse(
      Buffer
        .concat(chunks)
        .toString("utf8")
    );
  } catch (_) {
    return null;
  }
}


function getBaseUrl(req) {
  const configuredBase =
    String(
      process.env.APP_BASE_URL ||
      ""
    )
      .trim()
      .replace(/\/+$/, "");

  if (configuredBase) {
    return configuredBase;
  }

  const proto =
    String(
      req.headers["x-forwarded-proto"] ||
      "https"
    )
      .split(",")[0]
      .trim();

  const host =
    String(
      req.headers["x-forwarded-host"] ||
      req.headers.host ||
      ""
    )
      .split(",")[0]
      .trim();

  if (!host) {
    return "https://aivo.tr";
  }

  return `${proto}://${host}`;
}


function getSource(body) {
  return String(
    body?.source ||
    body?.app ||
    body?.from ||
    ""
  )
    .trim()
    .toLowerCase();
}


function getResetPath(source) {
  if (source === "ios") {
    return "/reset.ios.html";
  }

  if (
    source === "play" ||
    source === "android"
  ) {
    return "/reset.play.html";
  }

  if (source === "mobile") {
    return "/reset.mobile.html";
  }

  return "/reset.html";
}


async function getExistingUser(email) {
  if (
    typeof kvGetJson !== "function"
  ) {
    return null;
  }

  try {
    const primaryUser =
      await kvGetJson(
        `user:${email}`
      ).catch(
        () => null
      );

    if (
      primaryUser &&
      typeof primaryUser === "object"
    ) {
      return primaryUser;
    }

    const legacyUser =
      await kvGetJson(
        `users:${email}`
      ).catch(
        () => null
      );

    if (
      legacyUser &&
      typeof legacyUser === "object"
    ) {
      return legacyUser;
    }
  } catch (error) {
    console.error(
      "[FORGOT_USER_LOOKUP_FAIL]",
      error?.message ||
      error
    );
  }

  return null;
}


function getRequestLanguage(
  req,
  body,
  user
) {
  const requestedLanguage =
    body?.lang ||
    body?.language ||
    req?.headers?.["x-aivo-language"] ||
    user?.lang ||
    req?.headers?.["accept-language"] ||
    "tr";

  if (
    typeof normalizeLang ===
    "function"
  ) {
    return normalizeLang(
      requestedLanguage
    );
  }

  return String(
    requestedLanguage ||
    ""
  )
    .trim()
    .toLowerCase()
    .startsWith("en")
      ? "en"
      : "tr";
}


/* ============================================================
   HANDLER
   ============================================================ */

module.exports =
  async function handler(
    req,
    res
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "POST,OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-AIVO-Language"
    );


    /* --------------------------------------------------------
       OPTIONS
       -------------------------------------------------------- */

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }


    /* --------------------------------------------------------
       METHOD
       -------------------------------------------------------- */

    if (req.method !== "POST") {
      return json(
        res,
        405,
        {
          ok: false,
          reason: "method"
        }
      );
    }


    try {
      /* ------------------------------------------------------
         REQUEST
         ------------------------------------------------------ */

      const body =
        await readJson(req);

      if (!body) {
        return json(
          res,
          400,
          {
            ok: false,
            reason: "invalid_json"
          }
        );
      }


      const email =
        normalizeEmail(
          body.email
        );


      /*
        Kullanıcı hesabının sistemde bulunup
        bulunmadığını dışarıya belli etmiyoruz.
      */

      if (
        !email ||
        !email.includes("@")
      ) {
        return json(
          res,
          200,
          {
            ok: true
          }
        );
      }


      /* ------------------------------------------------------
         USER
         ------------------------------------------------------ */

      const existingUser =
        await getExistingUser(
          email
        );


      /*
        Kayıtlı kullanıcı yoksa yine aynı
        genel cevabı döndürürüz.

        Böylece bir e-posta adresinin AIVO'da
        kayıtlı olup olmadığı anlaşılamaz.
      */

      if (!existingUser) {
        return json(
          res,
          200,
          {
            ok: true
          }
        );
      }


      if (
        existingUser.disabled === true
      ) {
        return json(
          res,
          200,
          {
            ok: true
          }
        );
      }


      /* ------------------------------------------------------
         LANGUAGE + SOURCE
         ------------------------------------------------------ */

      const lang =
        getRequestLanguage(
          req,
          body,
          existingUser
        );

      const source =
        getSource(body);

      const resetPath =
        getResetPath(source);


      /* ------------------------------------------------------
         TOKEN
         ------------------------------------------------------ */

      const token =
        crypto
          .randomBytes(24)
          .toString("hex");

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

      const now =
        Date.now();

      const ttlSeconds =
        30 * 60;

      const expiresAt =
        now +
        ttlSeconds * 1000;

      const resetKey =
        `aivo:reset:${tokenHash}`;


      /* ------------------------------------------------------
         RESET URL
         ------------------------------------------------------ */

      const baseUrl =
        getBaseUrl(req)
          .replace(/\/+$/, "");

      const resetUrl =
        `${baseUrl}${resetPath}` +
        `?token=${encodeURIComponent(token)}` +
        `&lang=${encodeURIComponent(lang)}`;


      /* ------------------------------------------------------
         SAVE RESET RECORD
         ------------------------------------------------------ */

      await kv.set(
        resetKey,
        {
          email,
          lang,
          source,
          expiresAt,
          used: false,
          createdAt: now
        },
        {
          ex: ttlSeconds
        }
      );


      /* ------------------------------------------------------
         SEND LOCALIZED EMAIL
         ------------------------------------------------------ */

      let mailResult = {
        sent: false,
        reason:
          "auth_mail_helper_unavailable"
      };


      try {
        if (
          typeof sendPasswordResetEmail ===
          "function"
        ) {
          mailResult =
            await sendPasswordResetEmail({
              to: email,
              lang,
              resetUrl
            });
        }
      } catch (mailError) {
        mailResult = {
          sent: false,
          reason:
            "password_reset_mail_error",
          detail:
            mailError?.message ||
            String(mailError)
        };
      }


      if (!mailResult.sent) {
        console.error(
          "[FORGOT_PASSWORD_MAIL_FAIL]",
          mailResult
        );

        /*
          Gönderilemeyen bağlantının kullanılmaması
          için token kaydını temizle.
        */

        try {
          await kv.del(
            resetKey
          );
        } catch (_) {}

        return json(
          res,
          500,
          {
            ok: false,
            reason:
              "mail_send_failed"
          }
        );
      }


      /* ------------------------------------------------------
         RESPONSE
         ------------------------------------------------------ */

      return json(
        res,
        200,
        {
          ok: true
        }
      );
    } catch (error) {
      console.error(
        "[FORGOT_PASSWORD_FATAL]",
        error
      );

      return json(
        res,
        500,
        {
          ok: false,
          reason: "server_error"
        }
      );
    }
  };
