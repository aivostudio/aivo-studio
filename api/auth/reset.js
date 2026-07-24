// api/auth/reset.js

const crypto =
  require("crypto");

const bcrypt =
  require("bcryptjs");

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

const kvSetJson =
  kvApi.kvSetJson;

const normalizeLang =
  authMail.normalizeLang;

const sendPasswordChangedEmail =
  authMail.sendPasswordChangedEmail;


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


function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function getLanguage(
  resetRecord,
  user
) {
  const rawLanguage =
    resetRecord?.lang ||
    user?.lang ||
    "tr";

  if (
    typeof normalizeLang ===
    "function"
  ) {
    return normalizeLang(
      rawLanguage
    );
  }

  return String(rawLanguage || "")
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
      "Content-Type"
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
         BODY
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


      const token =
        String(
          body.token ||
          ""
        ).trim();

      const password =
        String(
          body.password ||
          ""
        );


      if (
        !token ||
        token.length < 16
      ) {
        return json(
          res,
          200,
          {
            ok: false,
            reason: "invalid"
          }
        );
      }


      if (
        !password ||
        password.length < 8
      ) {
        return json(
          res,
          200,
          {
            ok: false,
            reason: "weak"
          }
        );
      }


      /* ------------------------------------------------------
         TOKEN RECORD
         ------------------------------------------------------ */

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

      const resetKey =
        `aivo:reset:${tokenHash}`;

      const resetRecord =
        await kv.get(
          resetKey
        );


      if (!resetRecord) {
        return json(
          res,
          200,
          {
            ok: false,
            reason: "invalid"
          }
        );
      }


      if (
        resetRecord.used === true
      ) {
        return json(
          res,
          200,
          {
            ok: false,
            reason: "used"
          }
        );
      }


      const now =
        Date.now();


      if (
        now >
        Number(
          resetRecord.expiresAt ||
          0
        )
      ) {
        await kv.del(
          resetKey
        );

        return json(
          res,
          200,
          {
            ok: false,
            reason: "expired"
          }
        );
      }


      /* ------------------------------------------------------
         USER
         ------------------------------------------------------ */

      const email =
        normalizeEmail(
          resetRecord.email
        );


      if (!email) {
        await kv.del(
          resetKey
        );

        return json(
          res,
          200,
          {
            ok: false,
            reason: "invalid"
          }
        );
      }


      if (
        typeof kvGetJson !== "function" ||
        typeof kvSetJson !== "function"
      ) {
        return json(
          res,
          200,
          {
            ok: false,
            reason: "kv_not_available"
          }
        );
      }


      const primaryUserKey =
        `user:${email}`;

      const legacyUserKey =
        `users:${email}`;


      const primaryUser =
        await kvGetJson(
          primaryUserKey
        ).catch(
          () => null
        );

      const legacyUser =
        await kvGetJson(
          legacyUserKey
        ).catch(
          () => null
        );


      const existingUser =
        primaryUser &&
        typeof primaryUser === "object"
          ? primaryUser
          : (
              legacyUser &&
              typeof legacyUser === "object"
                ? legacyUser
                : null
            );


      if (!existingUser) {
        await kv.del(
          resetKey
        );

        return json(
          res,
          200,
          {
            ok: false,
            reason: "user_not_found"
          }
        );
      }


      /* ------------------------------------------------------
         PASSWORD FIELD
         ------------------------------------------------------ */

      const passwordField =
        existingUser.passwordHash
          ? "passwordHash"
          : existingUser.password_hash
            ? "password_hash"
            : existingUser.passHash
              ? "passHash"
              : existingUser.hash
                ? "hash"
                : "password";


      const nextPasswordValue =
        passwordField === "password"
          ? password
          : await bcrypt.hash(
              password,
              10
            );


      const lang =
        getLanguage(
          resetRecord,
          existingUser
        );

      const updatedAt =
        Date.now();


      /* ------------------------------------------------------
         UPDATE PRIMARY USER
         ------------------------------------------------------ */

      const nextPrimaryUser = {
        ...existingUser,
        email,
        lang,
        updatedAt,
        [passwordField]:
          nextPasswordValue
      };


      if (
        passwordField !== "password" &&
        Object.prototype.hasOwnProperty.call(
          nextPrimaryUser,
          "password"
        )
      ) {
        delete nextPrimaryUser.password;
      }


      await kvSetJson(
        primaryUserKey,
        nextPrimaryUser
      );


      /* ------------------------------------------------------
         UPDATE LEGACY USER
         ------------------------------------------------------ */

      if (
        legacyUser &&
        typeof legacyUser === "object"
      ) {
        const nextLegacyUser = {
          ...legacyUser,
          email,
          lang,
          updatedAt,
          [passwordField]:
            nextPasswordValue
        };


        if (
          passwordField !== "password" &&
          Object.prototype.hasOwnProperty.call(
            nextLegacyUser,
            "password"
          )
        ) {
          delete nextLegacyUser.password;
        }


        await kvSetJson(
          legacyUserKey,
          nextLegacyUser
        );
      }


      /* ------------------------------------------------------
         DELETE ONE-TIME TOKEN
         ------------------------------------------------------ */

      await kv.del(
        resetKey
      );


      /* ------------------------------------------------------
         PASSWORD CHANGED SECURITY EMAIL
         ------------------------------------------------------ */

      let securityMailResult = {
        sent: false,
        reason:
          "auth_mail_helper_unavailable"
      };


      try {
        if (
          typeof sendPasswordChangedEmail ===
          "function"
        ) {
          securityMailResult =
            await sendPasswordChangedEmail({
              to: email,
              lang
            });
        }
      } catch (mailError) {
        securityMailResult = {
          sent: false,
          reason:
            "password_changed_mail_error",
          detail:
            mailError?.message ||
            String(mailError)
        };
      }


      /*
        Güvenlik maili gönderilemezse yapılan
        şifre değişikliğini geri almıyoruz.
        Yalnızca sunucu kaydına yazıyoruz.
      */

      if (!securityMailResult.sent) {
        console.error(
          "[RESET_PASSWORD_SECURITY_MAIL_FAIL]",
          securityMailResult
        );
      }


      /* ------------------------------------------------------
         SUCCESS
         ------------------------------------------------------ */

      return json(
        res,
        200,
        {
          ok: true,
          mailSent:
            Boolean(
              securityMailResult.sent
            )
        }
      );
    } catch (error) {
      console.error(
        "[RESET_PASSWORD_FATAL]",
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
