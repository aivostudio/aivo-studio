const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function safeText(v) {
  const s = String(v == null ? "" : v).trim();
  return s || null;
}

function safeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function isValidDateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function resolveDateRange(dateStr) {
  const base = isValidDateOnly(dateStr)
    ? String(dateStr)
    : new Date().toISOString().slice(0, 10);

  const start = `${base}T00:00:00.000Z`;
  const end = `${base}T23:59:59.999Z`;

  return {
    date: base,
    start,
    end
  };
}

function createBucket(key, label) {
  return {
    key,
    label,
    spent_credits: 0,
    refund_credits: 0,
    net_credits: 0,
    transaction_count: 0
  };
}

function buildBuckets() {
  return {
    music: createBucket("music", "AI Müzik Üret"),
    cover: createBucket("cover", "AI Kapak Üret"),
    atmo: createBucket("atmo", "AI Atmosfer Video"),
    "cartoon:character": createBucket("cartoon:character", "AI Çocuk Çizgifilm — Karakter Yarat"),
    "cartoon:basic": createBucket("cartoon:basic", "AI Çocuk Çizgifilm — Basit Mod"),
    "cartoon:story": createBucket("cartoon:story", "AI Çocuk Çizgifilm — Hikaye Modu"),
    "cartoon:studio_export": createBucket("cartoon:studio_export", "AI Çocuk Çizgifilm — Montaj Stüdyosu"),
    photofx: createBucket("photofx", "AI Foto Efekt Video Clip"),
    video: createBucket("video", "AI Resimden Video Üret")
  };
}

function includesAny(haystack, needles) {
  const text = String(haystack || "").toLowerCase();
  return needles.some((item) => text.includes(String(item).toLowerCase()));
}

function resolveModuleKey(appInput, actionInput, reasonInput) {
  const app = String(appInput || "").toLowerCase();
  const action = String(actionInput || "").toLowerCase();
  const reason = String(reasonInput || "").toLowerCase();
  const text = `${app} ${action} ${reason}`.trim();

  if (includesAny(text, ["music", "muzik", "müzik"])) {
    return "music";
  }

  if (includesAny(text, ["cover", "kapak"])) {
    return "cover";
  }

  if (includesAny(text, ["atmo", "atmosfer", "atmosphere"])) {
    return "atmo";
  }

  if (includesAny(text, ["photofx", "photo fx", "foto efekt", "photo_effect", "photo-effect"])) {
    return "photofx";
  }

  if (
    includesAny(text, ["runway", "image to video", "text to video", "text-to-video", "image-to-video"]) ||
    (
      includesAny(text, ["video"]) &&
      !includesAny(text, ["atmo", "atmosfer", "photofx", "foto efekt", "cartoon", "çizgifilm", "cizgifilm"])
    )
  ) {
    return "video";
  }

  if (includesAny(text, ["cartoon", "çizgifilm", "cizgifilm", "studio_export", "story", "basic", "character", "karakter", "hikaye", "basit", "montaj"])) {
    if (includesAny(text, ["studio_export", "studio export", "export-create", "export create", "montaj", "share-ready", "paylasmaya hazir", "paylaşmaya hazır"])) {
      return "cartoon:studio_export";
    }

    if (includesAny(text, ["character", "karakter"])) {
      return "cartoon:character";
    }

    if (includesAny(text, ["basic", "basit"])) {
      return "cartoon:basic";
    }

    if (includesAny(text, ["story", "hikaye"])) {
      return "cartoon:story";
    }
  }

  return null;
}

function aggregateRows(rows) {
  const buckets = buildBuckets();

  const totals = {
    spent_credits: 0,
    refund_credits: 0,
    net_credits: 0,
    transaction_count: 0
  };

  let unmatched_count = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const kind = String(row?.kind || "").toLowerCase();
    const amount = safeInt(row?.amount);
    const moduleKey = resolveModuleKey(row?.app, row?.action, row?.reason);

    if (!moduleKey || !buckets[moduleKey]) {
      unmatched_count += 1;
      continue;
    }

    const bucket = buckets[moduleKey];
    bucket.transaction_count += 1;
    totals.transaction_count += 1;

    if (kind === "consume") {
      bucket.spent_credits += amount;
      totals.spent_credits += amount;
    } else if (kind === "refund") {
      bucket.refund_credits += amount;
      totals.refund_credits += amount;
    } else {
      unmatched_count += 1;
      bucket.transaction_count -= 1;
      totals.transaction_count -= 1;
      continue;
    }

    bucket.net_credits = bucket.spent_credits - bucket.refund_credits;
  }

  totals.net_credits = totals.spent_credits - totals.refund_credits;

  const modules = [
    buckets.music,
    buckets.cover,
    buckets.atmo,
    buckets["cartoon:character"],
    buckets["cartoon:basic"],
    buckets["cartoon:story"],
    buckets["cartoon:studio_export"],
    buckets.photofx,
    buckets.video
  ];

  return {
    modules,
    totals,
    unmatched_count
  };
}

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRows(modules) {
  const list = Array.isArray(modules) ? modules : [];

  return list.map((item) => {
    return `
      <tr>
        <td class="label">${esc(item.label || item.key || "-")}</td>
        <td class="num spent">${safeInt(item.spent_credits)}</td>
        <td class="num refund">${safeInt(item.refund_credits)}</td>
        <td class="num net">${safeInt(item.net_credits)}</td>
        <td class="num count">${safeInt(item.transaction_count)}</td>
      </tr>
    `;
  }).join("");
}

function renderHtml(payload) {
  const date = esc(payload?.date || "-");
  const modules = Array.isArray(payload?.modules) ? payload.modules : [];
  const totals = payload?.totals || {};
  const generatedAt = new Date().toLocaleString("tr-TR", { hour12: false });

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Günlük Kredi Raporu - ${date}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      color-scheme: light;
      --text: #111827;
      --muted: #6b7280;
      --line: #d1d5db;
      --head: #f3f4f6;
      --spent: #92400e;
      --refund: #065f46;
      --net: #1d4ed8;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      padding: 32px;
    }

    .sheet {
      width: 100%;
      max-width: 980px;
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
    }

    .brand {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: .2px;
    }

    .subtitle {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }

    .meta {
      text-align: right;
      font-size: 13px;
      color: var(--muted);
      line-height: 1.6;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: var(--head);
      text-align: left;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }

    tbody td, tfoot td {
      padding: 14px;
      border-bottom: 1px solid #eceff3;
      font-size: 14px;
    }

    tbody tr:last-child td {
      border-bottom: 1px solid var(--line);
    }

    .label {
      font-weight: 700;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }

    .spent { color: var(--spent); }
    .refund { color: var(--refund); }
    .net { color: var(--net); }
    .count { color: var(--text); }

    tfoot td {
      background: #fafafa;
      font-weight: 800;
      border-top: 2px solid var(--line);
      border-bottom: 0;
    }

    .footnote {
      margin-top: 14px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    @media print {
      body {
        padding: 0;
      }

      .sheet {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar">
      <div>
        <div class="brand">AIVO Admin</div>
        <div class="subtitle">Günlük Kredi İstatistikleri Raporu</div>
      </div>

      <div class="meta">
        <div><b>Tarih:</b> ${date}</div>
        <div><b>Oluşturulma:</b> ${esc(generatedAt)}</div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Modül</th>
            <th>Harcanan</th>
            <th>Refund</th>
            <th>Net</th>
            <th>İşlem</th>
          </tr>
        </thead>

        <tbody>
          ${renderRows(modules)}
        </tbody>

        <tfoot>
          <tr>
            <td>Toplam</td>
            <td class="num spent">${safeInt(totals.spent_credits)}</td>
            <td class="num refund">${safeInt(totals.refund_credits)}</td>
            <td class="num net">${safeInt(totals.net_credits)}</td>
            <td class="num count">${safeInt(totals.transaction_count)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="footnote">
      Bu rapor <code>credit_transactions</code> kayıtlarından, seçilen gün için
      <code>status = applied</code> olan kredi hareketleri baz alınarak üretildi.
    </div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
      }, 250);
    };
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();
    if (!conn) {
      return res.status(500).json({
        ok: false,
        error: "missing_db_env"
      });
    }

    if (typeof requireAuth !== "function") {
      return res.status(500).json({
        ok: false,
        error: "require_auth_missing"
      });
    }

    try {
      await requireAuth(req);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const dateParam = safeText(req.query?.date);
    const { date, start, end } = resolveDateRange(dateParam);

    const sql = neon(conn);

    const rows = await sql`
      select
        id,
        app,
        action,
        kind,
        amount,
        status,
        reason,
        created_at
      from credit_transactions
      where status = 'applied'
        and created_at >= ${start}::timestamptz
        and created_at <= ${end}::timestamptz
      order by created_at desc
    `;

    const summary = aggregateRows(rows);
    const html = renderHtml({
      date,
      modules: summary.modules,
      totals: summary.totals,
      unmatched_count: summary.unmatched_count
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (e) {
    console.error("admin/daily-credit-stats-pdf failed:", e);
    return res.status(500).json({
      ok: false,
      error: "daily_credit_stats_pdf_failed",
      message: String(e?.message || e)
    });
  }
};
