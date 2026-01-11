// api/invoices/get.js  (TEMP TEST - NO REDIS)
module.exports = async (req, res) => {
  return res.status(200).json({
    ok: true,
    test: "api_reached",
    query: req.query || null,
    ts: new Date().toISOString()
  });
};
