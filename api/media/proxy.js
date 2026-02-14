// api/media/proxy.js
// TEMP: route test

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    hit: "/api/media/proxy",
    method: req.method,
    url: req.query.url || null,
  });
};
