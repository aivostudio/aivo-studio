export default function handler(req, res) {
  // Oturum cookie adını bilmiyorsak önce default bir isimle başlarız.
  // Sonra DevTools -> Storage -> Cookies'ten gerçek adı bulup burayı güncelleriz.
  const cookieName = "session";

  res.setHeader("Set-Cookie", [
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ]);

  res.status(204).end();
}
