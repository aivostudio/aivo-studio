// api/stripe/webhook.js
// Stripe webhook (Next.js API route) - RAW body şarttır.
// KV yazımı: api/_kv.js üzerinden (Upstash/Vercel KV)

import Stripe from "stripe";
import kvMod from "../_kv.js";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function normEmail(s) {
  const email = String(s || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function parseInvoices(raw) {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  return [];
}

async function findPurchaseForRefund(kvGet, charge) {
  const receiptEmail = normEmail(
    charge?.billing_details?.email || charge?.receipt_email || ""
  );

  const invoiceId = String(charge?.invoice || "");
  const paymentIntent = String(charge?.payment_intent || "");
  const chargeId = String(charge?.id || "");
  const refundedAmountTry = Number(charge?.amount_refunded || 0) / 100;

  async function scanInvoicesForEmail(email) {
    const emailNorm = normEmail(email);
    if (!emailNorm) return null;

    const emailInvoicesKey = `invoices:${emailNorm}`;
    const raw = await kvGet(emailInvoicesKey);
    const invoices = parseInvoices(raw);

    if (!Array.isArray(invoices) || !invoices.length) return null;

    const exactMatch = invoices.find((item) => {
      if (!item || item.type !== "purchase" || !item.stripe) return false;

      return (
        (invoiceId && String(item.stripe.invoice_id || "") === invoiceId) ||
        (paymentIntent && String(item.stripe.payment_intent || "") === paymentIntent) ||
        (chargeId && String(item.stripe.charge_id || "") === chargeId)
      );
    });

    if (exactMatch) {
      return {
        email: emailNorm,
        purchase: exactMatch,
      };
    }

    const fallbackMatch = invoices.find((item) => {
      if (!item || item.type !== "purchase") return false;

      const itemAmount = Number(item.amount_try || 0);
      const itemEmail = normEmail(item.email || "");

      return (
        itemEmail === emailNorm &&
        refundedAmountTry > 0 &&
        itemAmount > 0 &&
        itemAmount === refundedAmountTry
      );
    });

    if (fallbackMatch) {
      return {
        email: emailNorm,
        purchase: fallbackMatch,
      };
    }

    return null;
  }

  if (receiptEmail) {
    const direct = await scanInvoicesForEmail(receiptEmail);
    if (direct) return direct;
  }

  const fallbackEmail = normEmail(charge?.metadata?.email || "");
  if (fallbackEmail && fallbackEmail !== receiptEmail) {
    const metaMatch = await scanInvoicesForEmail(fallbackEmail);
    if (metaMatch) return metaMatch;
  }

  return {
    email: receiptEmail || fallbackEmail || "",
    purchase: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).send("Missing Stripe-Signature header");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET env");
  }

  const kv = kvMod?.default || kvMod || {};
  const kvGet = kv.kvGet;
  const kvSet = kv.kvSet;
  const kvIncr = kv.kvIncr;

  if (
    typeof kvGet !== "function" ||
    typeof kvSet !== "function" ||
    typeof kvIncr !== "function"
  ) {
    return res.status(500).send("KV helpers missing (kvGet/kvSet/kvIncr)");
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("[WEBHOOK] signature/construct fail:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message || "UNKNOWN"}`);
  }

  const isCheckoutCompleted = event.type === "checkout.session.completed";
  const isChargeRefunded = event.type === "charge.refunded";

  if (!isCheckoutCompleted && !isChargeRefunded) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      type: event.type,
    });
  }

  const dedupeKey = isCheckoutCompleted
    ? `stripe:event:${event.id}`
    : `stripe:refund:${event.id}`;

  try {
    const seen = await kvGet(dedupeKey);
    if (seen) {
      return res.status(200).json({ ok: true, deduped: true });
    }
  } catch (_) {}

  const session = isCheckoutCompleted ? event.data.object : null;
  const charge = isChargeRefunded ? event.data.object : null;

  if (isCheckoutCompleted) {
    console.log("[WEBHOOK] checkout.session.completed", {
      session_id: session?.id || "",
      session_invoice: session?.invoice || "",
      payment_status: session?.payment_status || "",
      customer_email: session?.customer_email || "",
      metadata_email: session?.metadata?.email || "",
    });
  }

  if (isChargeRefunded) {
    console.log("[WEBHOOK] charge.refunded", {
      charge_id: charge?.id || "",
      payment_intent: charge?.payment_intent || "",
      invoice_id: charge?.invoice || "",
      amount_refunded: charge?.amount_refunded || 0,
      receipt_email: charge?.billing_details?.email || charge?.receipt_email || "",
    });
  }

  try {
    let email = "";
    let credits = 0;
    let invoice = null;
    let before = null;
    let afterIncr = null;
    let after = null;

    if (isCheckoutCompleted) {
      const paymentStatus = String(session?.payment_status || "");
      if (paymentStatus !== "paid") {
        return res.status(200).json({
          ok: true,
          notPaid: true,
          payment_status: paymentStatus,
        });
      }

      credits = Number(session?.metadata?.credits || 0);
      email = normEmail(session?.metadata?.email || session?.customer_email);

      if (!email) {
        return res.status(200).json({ ok: false, missingEmail: true });
      }

      if (!Number.isFinite(credits) || credits <= 0) {
        return res.status(200).json({
          ok: false,
          invalidCredits: true,
          creditsRaw: session?.metadata?.credits,
        });
      }

      const creditsKey = `credits:${email}`;
      const invoicesKey = `invoices:${email}`;

      before = await kvGet(creditsKey);
      afterIncr = await kvIncr(creditsKey, credits);
      after = await kvGet(creditsKey);

      let stripeInvoice = null;
      let pdfUrl = "";
      let aivoHtml = "";
      let chargeId = "";

      if (session?.invoice) {
        try {
          stripeInvoice = await stripe.invoices.retrieve(session.invoice);
          pdfUrl = String(
            stripeInvoice?.invoice_pdf ||
            stripeInvoice?.hosted_invoice_url ||
            ""
          );

          chargeId = String(
            stripeInvoice?.charge ||
            stripeInvoice?.payment_intent?.latest_charge ||
            ""
          );

          const generated = await fetch("https://aivo.tr/api/invoices/generate", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              stripe_invoice_id: stripeInvoice?.id || String(session?.invoice || ""),
              email,
              customer_name:
                stripeInvoice?.customer_name ||
                stripeInvoice?.customer_email ||
                email,
              customer_country: "Türkiye",
              item_title: "AIVO Pro",
              amount_try: session?.amount_total
                ? Number(session.amount_total) / 100
                : null,
            }),
          });

          const generatedJson = await generated.json().catch(() => null);

          if (generated?.ok && generatedJson?.ok && generatedJson?.html) {
            aivoHtml = String(generatedJson.html || "");
          } else {
            console.log("[WEBHOOK] aivo invoice generate failed", {
              status: generated?.status || 0,
              body: generatedJson || null,
              stripe_invoice_id:
                stripeInvoice?.id || String(session?.invoice || ""),
            });
          }
        } catch (err) {
          console.log("[WEBHOOK] stripe invoice retrieve fail:", err?.message, {
            session_id: session?.id,
            stripe_invoice_id: session?.invoice,
          });
        }
      }

      invoice = {
        id: `stripe_${session?.id || event?.id || Date.now()}`,
        provider: "stripe",
        type: "purchase",
        title: "Kredi Satın Alımı",
        pack: String(session?.metadata?.pack || ""),
        credits: credits,
        amount_try: session?.amount_total
          ? Number(session.amount_total) / 100
          : null,
        created_at: new Date().toISOString(),
        status: "paid",
        pdf_url: pdfUrl,
        aivo_html: aivoHtml,
        email,
        stripe: {
          session_id: session?.id || "",
          event_id: event?.id || "",
          invoice_id: stripeInvoice?.id || String(session?.invoice || ""),
          payment_intent: session?.payment_intent || "",
          charge_id: chargeId,
        },
      };

      const rawInvoices = await kvGet(invoicesKey);
      const invoices = parseInvoices(rawInvoices);
      invoices.unshift(invoice);
      await kvSet(invoicesKey, JSON.stringify(invoices));
      await kvSet(dedupeKey, "1", { ex: 60 * 60 * 24 * 7 });

      console.log("[WEBHOOK] purchase saved", {
        email,
        creditsKey,
        invoicesKey,
        credits,
        before,
        afterIncr,
        after,
        invoice_id: invoice.id,
        session_id: session?.id || "",
        event_id: event?.id || "",
      });

      return res.status(200).json({ ok: true, type: "purchase" });
    }

    if (isChargeRefunded) {
      const { email: matchedEmail, purchase } = await findPurchaseForRefund(kvGet, charge);

      if (!purchase || !matchedEmail) {
        console.log("[WEBHOOK] refund purchase not found", {
          charge_id: charge?.id || "",
          invoice_id: charge?.invoice || "",
          payment_intent: charge?.payment_intent || "",
          receipt_email:
            charge?.billing_details?.email || charge?.receipt_email || "",
        });

        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "purchase_not_found_for_refund",
        });
      }

      email = matchedEmail;
      credits = Number(purchase?.credits || purchase?.credit_count || 0);

      const creditsKey = `credits:${email}`;
      const invoicesKey = `invoices:${email}`;
      const rawInvoices = await kvGet(invoicesKey);
      const invoices = parseInvoices(rawInvoices);

      const alreadyExists = invoices.some((item) => {
        if (!item || item.type !== "refund" || !item.stripe) return false;

        return (
          String(item.stripe.charge_id || "") === String(charge?.id || "") ||
          String(item.stripe.event_id || "") === String(event?.id || "") ||
          (
            String(item.stripe.invoice_id || "") === String(charge?.invoice || "") &&
            Number(item.amount_try || 0) === -(Number(charge?.amount_refunded || 0) / 100)
          )
        );
      });

      if (alreadyExists) {
        return res.status(200).json({
          ok: true,
          deduped: true,
          type: "refund",
        });
      }

      if (Number.isFinite(credits) && credits > 0) {
        before = await kvGet(creditsKey);
        afterIncr = await kvIncr(creditsKey, -credits);
        after = await kvGet(creditsKey);
      }

      invoice = {
        id: `stripe_refund_${charge?.id || event?.id || Date.now()}`,
        provider: "stripe",
        type: "refund",
        title: "Kredi İadesi",
        pack: String(purchase?.pack || ""),
        credits: credits,
        amount_try: charge?.amount_refunded
          ? -(Number(charge.amount_refunded) / 100)
          : null,
        created_at: new Date().toISOString(),
        refunded_at: new Date().toISOString(),
        status: "refunded",
        pdf_url: "",
        aivo_html: "",
        email,
        stripe: {
          session_id: purchase?.stripe?.session_id || "",
          event_id: event?.id || "",
          invoice_id: charge?.invoice || purchase?.stripe?.invoice_id || "",
          charge_id: charge?.id || "",
          payment_intent: charge?.payment_intent || "",
        },
      };

      invoices.unshift(invoice);
      await kvSet(invoicesKey, JSON.stringify(invoices));
      await kvSet(dedupeKey, "1", { ex: 60 * 60 * 24 * 7 });

      console.log("[WEBHOOK] refund saved", {
        email,
        creditsKey,
        invoicesKey,
        credits,
        before,
        afterIncr,
        after,
        invoice_id: invoice.id,
        charge_id: charge?.id || "",
        event_id: event?.id || "",
      });

      return res.status(200).json({ ok: true, type: "refund" });
    }

    return res.status(200).json({ ok: true, skipped: true });
  } catch (err) {
    console.log("[WEBHOOK] KV write fail:", err?.message, {
      type: event?.type || "",
    });

    return res.status(500).json({
      ok: false,
      error: "KV_WRITE_FAIL",
      message: err?.message || "UNKNOWN",
    });
  }
}
