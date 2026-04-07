module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        ok: false,
        error: "google_oauth_env_missing"
      });
    }

    const rawReturn =
      typeof req.query?.return === "string" && req.query.return.trim()
        ? req.query.return.trim()
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
      `aivo_google_state=${stateNonce}; Path=/; Domain=.aivo.tr; HttpOnly; SameSite=Lax; Secure; Max-Age=600`
    );

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", clientId);
    googleUrl.searchParams.set("redirect_uri", redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("prompt", "select_account");
    googleUrl.searchParams.set("access_type", "offline");
    googleUrl.searchParams.set("state", state);

    return res.redirect(302, googleUrl.toString());
  } catch (err) {
    console.error("[auth/google] error:", err);
    return res.status(500).json({
      ok: false,
      error: "google_entry_failed"
    });
  }
};
