/* /api/auth/password-update.js */

import crypto from "crypto";
import bcrypt from "bcryptjs";

import kvMod from "../_kv.js";
import authMailMod from "../../lib/mail/auth-mail.cjs";


/* ============================================================
   MODULES
   ============================================================ */

const kv =
  kvMod?.default ||
  kvMod ||
  {};

const kvGetJson =
  kv.kvGetJson;

const kvSetJson =
  kv.kvSetJson;


const authMail =
  authMailMod?.default ||
  authMailMod ||
  {};

const normalizeLang =
  authMail.normalizeLang;

const sendPasswordChangedEmail =
  authMail.sendPasswordChangedEmail;


const COOKIE_KV =
  "aivo_sess";


/* ============================================================
   RESPONSE
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


/* ============================================================
   COOKIE
   ============================================================ */

function parseCookies(header) {
  const output = {};

  if (!header) {
    return output;
  }

  String(header)
    .split(";")
    .forEach(function (part) {
      const separatorIndex =
        part.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const key =
        part
          .slice(0, separatorIndex)
          .trim();

      const value =
        part
          .slice(separatorIndex + 1)
          .trim();

      if (key) {
        output[key] = value;
      }
    });

  return output;
}


/* ============================================================
   TEXT HELPERS
   ============================================================ */

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function cleanText(value) {
  return String(value || "")
    .trim();
}


/* ============================================================
   BODY
   ============================================================ */

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


/* ============================================================
   HASH
   ============================================================ */

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(
      String(value || ""),
      "utf8"
    )
    .digest("hex");
}


/* ============================================================
   LANGUAGE
   ============================================================ */

function getRequestLanguage(
  req,
  body,
  user,
  session
) {
  const rawLanguage =
    body?.lang ||
    body?.language ||
    req?.headers?.["x-aivo-language"] ||
    user?.lang ||
    session?.lang ||
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
   PASSWORD VERIFY
   ============================================================ */

async function verifyPasswordAgainstUser(
  user,
  plainPassword
) {
  const plain =
    String(
      plainPassword ||
      ""
    );

  if (!plain) {
    return false;
  }


  /* ----------------------------------------------------------
     LEGACY PLAIN PASSWORD
     ---------------------------------------------------------- */

  const directPlain =
    user?.password;

  if (
    directPlain &&
    String(directPlain) === plain
  ) {
    return true;
  }


  /* ----------------------------------------------------------
     HASHED PASSWORDS
     ---------------------------------------------------------- */

  const hashFields = [
    user?.passwordHash,
    user?.password_hash,
    user?.passHash,
    user?.hash
  ];


  for (const value of hashFields) {
    if (!value) {
      continue;
    }

    const storedValue =
      String(value);


    /*
      Eski SHA-256 kayıt desteği
    */

    if (
      storedValue ===
      sha256(plain)
    ) {
      return true;
    }


    /*
      Bcrypt kayıt desteği
    */

    const matches =
      await bcrypt
        .compare(
          plain,
          storedValue
        )
        .catch(
          () => false
        );

    if (matches) {
      return true;
    }
  }


  return false;
}


/* ============================================================
   NEW PASSWORD VALUE
   ============================================================ */

async function buildNextPasswordValue(
  existingUser,
  newPassword
) {
  if (
    existingUser?.passwordHash ||
    existingUser?.password_hash ||
    existingUser?.passHash ||
    existingUser?.hash
  ) {
    const field =
      existingUser.passwordHash
        ? "passwordHash"
        : existingUser.password_hash
          ? "password_hash"
          : existingUser.passHash
            ? "passHash"
            : "hash";

    return {
      field,

      value:
        await bcrypt.hash(
          String(
            newPassword ||
            ""
          ),
          10
        )
    };
  }


  /*
    Eski düz şifre kaydı varsa mevcut
    veri yapısını bozmadan korur.
  */

  return {
    field: "password",

    value:
      String(
        newPassword ||
        ""
      )
  };
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

      return json(
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
      typeof kvGetJson !== "function" ||
      typeof kvSetJson !== "function"
    ) {
      return json(
        res,
        503,
        {
          ok: false,
          error: "kv_not_available"
        }
      );
    }


    /* --------------------------------------------------------
       SESSION
       -------------------------------------------------------- */

    const cookies =
      parseCookies(
        req.headers.cookie
      );

    const sessionId =
      cookies[COOKIE_KV];


    if (!sessionId) {
      return json(
        res,
        401,
        {
          ok: false,
          error: "no_session"
        }
      );
    }


    const session =
      await kvGetJson(
        `sess:${sessionId}`
      ).catch(
        () => null
      );


    if (
      !session ||
      typeof session !== "object" ||
      !session.email
    ) {
      return json(
        res,
        401,
        {
          ok: false,
          error: "invalid_session"
        }
      );
    }


    const email =
      normalizeEmail(
        session.email
      );


    if (!email) {
      return json(
        res,
        401,
        {
          ok: false,
          error: "invalid_session"
        }
      );
    }


    /* --------------------------------------------------------
       BODY
       -------------------------------------------------------- */

    const body =
      await readJson(req);


    if (!body) {
      return json(
        res,
        400,
        {
          ok: false,
          error: "invalid_json"
        }
      );
    }


    const currentPassword =
      cleanText(
        body.currentPassword
      );

    const newPassword =
      cleanText(
        body.newPassword
      );

    const newPassword2 =
      cleanText(
        body.newPassword2
      );


    /* --------------------------------------------------------
       VALIDATION
       -------------------------------------------------------- */

    if (
      !currentPassword ||
      !newPassword ||
      !newPassword2
    ) {
      return json(
        res,
        400,
        {
          ok: false,
          error: "missing_fields"
        }
      );
    }


    if (newPassword.length < 8) {
      return json(
        res,
        400,
        {
          ok: false,
          error: "password_too_short"
        }
      );
    }


    if (
      newPassword !==
      newPassword2
    ) {
      return json(
        res,
        400,
        {
          ok: false,
          error: "password_mismatch"
        }
      );
    }


    if (
      currentPassword ===
      newPassword
    ) {
      return json(
        res,
        400,
        {
          ok: false,
          error: "password_same_as_old"
        }
      );
    }


    /* --------------------------------------------------------
       USER
       -------------------------------------------------------- */

    const userKeyPrimary =
      `user:${email}`;

    const userKeyLegacy =
      `users:${email}`;


    const primaryUser =
      await kvGetJson(
        userKeyPrimary
      ).catch(
        () => null
      );

    const legacyUser =
      await kvGetJson(
        userKeyLegacy
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
      return json(
        res,
        404,
        {
          ok: false,
          error: "user_not_found"
        }
      );
    }


    /* --------------------------------------------------------
       CURRENT PASSWORD CHECK
       -------------------------------------------------------- */

    const currentPasswordValid =
      await verifyPasswordAgainstUser(
        existingUser,
        currentPassword
      );


    if (!currentPasswordValid) {
      return json(
        res,
        400,
        {
          ok: false,
          error:
            "current_password_invalid"
        }
      );
    }


    /* --------------------------------------------------------
       LANGUAGE
       -------------------------------------------------------- */

    const lang =
      getRequestLanguage(
        req,
        body,
        existingUser,
        session
      );


    /* --------------------------------------------------------
       BUILD PASSWORD
       -------------------------------------------------------- */

    const passwordWrite =
      await buildNextPasswordValue(
        existingUser,
        newPassword
      );

    const now =
      Date.now();


    /* --------------------------------------------------------
       UPDATE PRIMARY USER
       -------------------------------------------------------- */

    const nextUser = {
      ...existingUser,
      email,
      lang,
      updatedAt: now,
      [passwordWrite.field]:
        passwordWrite.value
    };


    if (
      passwordWrite.field !== "password" &&
      Object.prototype.hasOwnProperty.call(
        nextUser,
        "password"
      )
    ) {
      delete nextUser.password;
    }


    await kvSetJson(
      userKeyPrimary,
      nextUser
    );


    /* --------------------------------------------------------
       UPDATE LEGACY USER
       -------------------------------------------------------- */

    if (
      legacyUser &&
      typeof legacyUser === "object"
    ) {
      const nextLegacy = {
        ...legacyUser,
        email,
        lang,
        updatedAt: now,
        [passwordWrite.field]:
          passwordWrite.value
      };


      if (
        passwordWrite.field !== "password" &&
        Object.prototype.hasOwnProperty.call(
          nextLegacy,
          "password"
        )
      ) {
        delete nextLegacy.password;
      }


      await kvSetJson(
        userKeyLegacy,
        nextLegacy
      );
    }


    /* --------------------------------------------------------
       PASSWORD CHANGED SECURITY EMAIL
       -------------------------------------------------------- */

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
      Mail gönderilemese bile başarılı şifre
      değişikliğini geri almıyoruz.
    */

    if (!securityMailResult.sent) {
      console.error(
        "[PASSWORD_UPDATE_SECURITY_MAIL_FAIL]",
        securityMailResult
      );
    }


    /* --------------------------------------------------------
       SUCCESS
       -------------------------------------------------------- */

    return json(
      res,
      200,
      {
        ok: true,
        email,
        lang,
        updatedAt: now,
        mailSent:
          Boolean(
            securityMailResult.sent
          )
      }
    );
  } catch (error) {
    console.error(
      "[PASSWORD_UPDATE_FATAL]",
      error
    );

    return json(
      res,
      500,
      {
        ok: false,
        error: "server_error",
        message:
          String(
            error?.message ||
            error
          )
      }
    );
  }
}
