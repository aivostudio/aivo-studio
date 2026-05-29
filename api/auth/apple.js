import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const clientId = process.env.APPLE_CLIENT_ID;
    const redirectUri = process.env.APPLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        ok: false,
        error: "apple_oauth_env_missing"
      });
    }

    const rawReturn =
      typeof req.query?.returnTo === "string" && req.query.returnTo.trim()
        ? req.query.returnTo.trim()
        : "/studio.v2.html";

    const returnTo =
      rawReturn.startsWith("/") && !rawReturn.startsWith("//")
        ? rawReturn
        : "/studio.v2.html";

    const stateNonce = crypto.randomBytes(16).toString("hex");

    const statePayload = {
      returnTo,
      ts: Date.now(),
      nonce: stateNonce
    };

    const state = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64url");

    res.setHeader(
      "Set-Cookie",
    `aivo_apple_state=${stateNonce}; Path=/; Domain=.aivo.tr; HttpOnly; SameSite=None; Secure; Max-Age=600`
    );

    const appleUrl = new URL("https://appleid.apple.com/auth/authorize");
    appleUrl.searchParams.set("client_id", clientId);
    appleUrl.searchParams.set("redirect_uri", redirectUri);
    appleUrl.searchParams.set("response_type", "code");
    appleUrl.searchParams.set("response_mode", "form_post");
    appleUrl.searchParams.set("scope", "name email");
    appleUrl.searchParams.set("state", state);

    return res.redirect(302, appleUrl.toString());
  } catch (err) {
    console.error("[auth/apple] error:", err);
    return res.status(500).json({
      ok: false,
      error: "apple_entry_failed"
    });
  }
}
