// api/auth/register.js

import crypto from "crypto";
import bcrypt from "bcryptjs";

import authMailMod from "../../lib/mail/auth-mail.cjs";

// KV helper
import kvMod from "../_kv.js";


/* ============================================================
   MODULES
   ============================================================ */

const kv =
  kvMod?.default ||
  kvMod ||
  {};

const kvSetJson =
  kv.kvSetJson;

const kvGetJson =
  kv.kvGetJson;


const authMail =
  authMailMod?.default ||
  authMailMod ||
  {};

const normalizeLang =
  authMail.normalizeLang;

const sendVerificationEmail =
  authMail.sendVerificationEmail;


/* ============================================================
   HELPERS
   ============================================================ */

const env = (key, fallback = "") =>
  String(
    process.env[key] ||
    fallback
  ).trim();


const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();


function sendJson(
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


function getRequestLanguage(
  req,
  body
) {
  const rawLanguage =
    body?.lang ||
    body?.language ||
    req?.headers?.["x-aivo-language"] ||
    req?.headers?.["accept-language"] ||
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

export default async function handler(
  req,
  res
) {
  try {
    /* --------------------------------------------------------
       METHOD
       -------------------------------------------------------- */

    if (req.method !== "POST") {
      res.setHeader(
        "Allow",
        "POST"
      );

      return sendJson(
        res,
        405,
        {
          ok: false,
          error: "method_not_allowed"
        }
      );
    }


    /* --------------------------------------------------------
       KV CHECK
       -------------------------------------------------------- */

    if (
      typeof kvSetJson !== "function" ||
      typeof kvGetJson !== "function"
    ) {
      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            "kv helpers missing (kvSetJson/kvGetJson undefined). Check api/_kv.js export style."
        }
      );
    }


    /* --------------------------------------------------------
       REQUEST BODY
       -------------------------------------------------------- */

    const body =
      await readJson(req);

    if (!body) {
      return sendJson(
        res,
        400,
        {
          ok: false,
          error: "invalid_json"
        }
      );
    }


    const email =
      normalizeEmail(
        body.email
      );

    const password =
      String(
        body.password ||
        ""
      );

    const name =
      String(
        body.name ||
        ""
      ).trim();

    const lang =
      getRequestLanguage(
        req,
        body
      );


    /* --------------------------------------------------------
       VALIDATION
       -------------------------------------------------------- */

    if (
      !email ||
      !email.includes("@")
    ) {
      return sendJson(
        res,
        400,
        {
          ok: false,
          error: "email_invalid"
        }
      );
    }


    if (password.length < 6) {
      return sendJson(
        res,
        400,
        {
          ok: false,
          error: "password_too_short"
        }
      );
    }


    if (!name) {
      return sendJson(
        res,
        400,
        {
          ok: false,
          error: "name_required"
        }
      );
    }


    /* --------------------------------------------------------
       BAN CHECK
       -------------------------------------------------------- */

    let banned = null;

    try {
      banned =
        await kvGetJson(
          `ban:${email}`
        );
    } catch (error) {
      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            error?.message ||
            String(error)
        }
      );
    }


    if (banned) {
      return sendJson(
        res,
        403,
        {
          ok: false,
          error: "user_banned"
        }
      );
    }


    /* --------------------------------------------------------
       EXISTING USER CHECK
       -------------------------------------------------------- */

    let existingUser = null;

    try {
      const userPrimary =
        await kvGetJson(
          `user:${email}`
        ).catch(
          () => null
        );

      const userLegacy =
        await kvGetJson(
          `users:${email}`
        ).catch(
          () => null
        );

      existingUser =
        userPrimary &&
        typeof userPrimary === "object"
          ? userPrimary
          : (
              userLegacy &&
              typeof userLegacy === "object"
                ? userLegacy
                : null
            );
    } catch (error) {
      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            error?.message ||
            String(error)
        }
      );
    }


    if (existingUser) {
      return sendJson(
        res,
        409,
        {
          ok: false,
          error:
            "email_already_registered"
        }
      );
    }


    /* --------------------------------------------------------
       VERIFICATION TOKEN
       -------------------------------------------------------- */

    const token =
      crypto
        .randomBytes(32)
        .toString("hex");

    const now =
      Date.now();

    const appBase =
      env(
        "APP_BASE_URL",
        "https://aivo.tr"
      ).replace(
        /\/+$/,
        ""
      );

    const from =
      String(
        body.from ||
        body.source ||
        ""
      )
        .trim()
        .toLowerCase();


    let verifyReturnTo =
      "/login.html?returnTo=/studio.v2.html";


    if (from === "ios") {
      verifyReturnTo =
        "/login.ios.html?returnTo=/studio.ios.html";
    } else if (
      from === "play" ||
      from === "android"
    ) {
      verifyReturnTo =
        "/login.play.html?returnTo=/studio.play.html";
    } else if (
      from === "mobile"
    ) {
      verifyReturnTo =
        "/login.mobile.html?returnTo=/studio.mobile.html";
    }


    const verifyUrl =
      `${appBase}/api/auth/verify` +
      `?token=${encodeURIComponent(token)}` +
      `&from=${encodeURIComponent(from)}` +
      `&lang=${encodeURIComponent(lang)}` +
      `&returnTo=${encodeURIComponent(verifyReturnTo)}`;


    /* --------------------------------------------------------
       PASSWORD HASH
       -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );


    /* --------------------------------------------------------
       SAVE VERIFICATION PAYLOAD
       -------------------------------------------------------- */

    try {
      await kvSetJson(
        `verify:${token}`,
        {
          email,
          name,
          lang,
          passwordHash,
          createdAt: now
        },
        {
          ex: 60 * 60
        }
      );
    } catch (error) {
      console.error(
        "[REGISTER_KV_SET_FAIL]",
        error?.message ||
        error
      );

      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            error?.message ||
            String(error)
        }
      );
    }


    /* --------------------------------------------------------
       CREATE USER — VERIFIED FALSE
       -------------------------------------------------------- */

    try {
      await kvSetJson(
        `user:${email}`,
        {
          email,
          name,
          lang,
          role: "user",
          disabled: false,
          verified: false,
          passwordHash,
          createdAt: now,
          updatedAt: now
        }
      );
    } catch (error) {
      console.error(
        "[REGISTER_USER_SET_FAIL]",
        error?.message ||
        error
      );

      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            error?.message ||
            String(error)
        }
      );
    }


    /* --------------------------------------------------------
       USERS LIST INDEX
       -------------------------------------------------------- */

    try {
      const listKey =
        "users:list";

      const currentList =
        await kvGetJson(
          listKey
        );

      const list =
        Array.isArray(currentList)
          ? currentList
          : [];

      const alreadyListed =
        list.some(
          (user) =>
            normalizeEmail(
              user?.email
            ) === email
        );


      if (!alreadyListed) {
        list.unshift({
          email,
          lang,
          role: "user",
          disabled: false,
          verified: false,
          createdAt: now,
          updatedAt: now
        });

        await kvSetJson(
          listKey,
          list
        );
      }
    } catch (error) {
      console.error(
        "[REGISTER_USERS_LIST_FAIL]",
        error?.message ||
        error
      );

      return sendJson(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available",
          hint:
            error?.message ||
            String(error)
        }
      );
    }


    /* --------------------------------------------------------
       SEND LOCALIZED VERIFICATION EMAIL
       -------------------------------------------------------- */

    let mailResult = {
      sent: false,
      reason:
        "auth_mail_helper_unavailable"
    };


    try {
      if (
        typeof sendVerificationEmail ===
        "function"
      ) {
        mailResult =
          await sendVerificationEmail({
            to: email,
            lang,
            verifyUrl,
            name
          });
      }
    } catch (mailError) {
      mailResult = {
        sent: false,
        reason: "auth_mail_error",
        detail:
          mailError?.message ||
          String(mailError)
      };
    }


    if (!mailResult.sent) {
      console.error(
        "[REGISTER_VERIFICATION_MAIL_FAIL]",
        mailResult
      );
    }


    /* --------------------------------------------------------
       RESPONSE
       -------------------------------------------------------- */

    return sendJson(
      res,
      201,
      {
        ok: true,
        email,
        lang,
        verifyUrl,
        mailSent:
          Boolean(
            mailResult.sent
          )
      }
    );
  } catch (error) {
    console.error(
      "[REGISTER_FATAL]",
      error
    );

    return sendJson(
      res,
      500,
      {
        ok: false,
        error: "server_error"
      }
    );
  }
}
