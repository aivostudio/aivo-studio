return res.json({
  ok: true,
  sub: user.id || user.email, // hangisi senin GERÇEK user ID’inse
  email: user.email,
  role: user.role,
  verified: true,
});
