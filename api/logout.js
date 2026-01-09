export default function handler(req, res) {
  // GET/POST fark etmesin
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Senin tarafta cookie adı net değil; yaygın isimleri de sıfırlıyoruz.
  const cookiesToClear = [
    "session",
    "aivo_session",
    "connect.sid",
  ];

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader(
    "Set-Cookie",
    cookiesToClear.map((name) =>
      // Max-Age=0 + Expires ile kesin düşür
      `${name}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    )
  );

  res.status(204).end();
}
