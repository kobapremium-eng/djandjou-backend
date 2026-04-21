const router = require("express").Router();
const db = require("../db");
const authMW = require("../middleware/auth");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  premium: { monthly: 4900, yearly: 49000 },
  vip:     { monthly: 12500, yearly: 120000 },
};

router.post("/stripe/create", authMW, async (req, res) => {
  const { plan, billing_cycle } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan invalide." });
  const amount = PLANS[plan][billing_cycle || "monthly"];
  try {
    const user = await db.query(
      "SELECT email, full_name FROM users WHERE id = $1", [req.userId]
    );
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "xof",
          product_data: { name: `DJANDJOU 3.0 — ${plan} (${billing_cycle})` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      customer_email: user.rows[0].email,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment-success`,
      cancel_url: `${process.env.FRONTEND_URL}/premium`,
      metadata: { user_id: req.userId, plan, billing_cycle },
    });
    await db.query(
      `INSERT INTO subscriptions (user_id, plan, billing_cycle, amount, payment_method, payment_ref, status)
       VALUES ($1, $2, $3, $4, 'stripe', $5, 'pending')`,
      [req.userId, plan, billing_cycle, amount, session.id]
    );
    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur paiement Stripe." });
  }
});

router.post("/fedapay/create", authMW, async (req, res) => {
  const { plan, billing_cycle, phone_number, network } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan invalide." });
  if (!phone_number) return res.status(400).json({ error: "Numéro requis." });
  const amount = PLANS[plan][billing_cycle || "monthly"];
  try {
    const user = await db.query(
      "SELECT email, full_name FROM users WHERE id = $1", [req.userId]
    );
    const fedaRes = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      },
      body: JSON.stringify({
        description: `DJANDJOU 3.0 — ${plan}`,
        amount,
        currency: { iso: "XOF" },
        callback_url: `${process.env.API_URL}/api/payments/fedapay/callback`,
        customer: { email: user.rows[0].email },
      }),
    });
    const fedaData = await fedaRes.json();
    const transactionId = fedaData.v1?.transaction?.id;
    const paymentUrl = fedaData.v1?.transaction?.links?.payment_url;
    await db.query(
      `INSERT INTO subscriptions (user_id, plan, billing_cycle, amount, payment_method, payment_ref, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [req.userId, plan, billing_cycle, amount, `fedapay_${network}`, String(transactionId)]
    );
    res.json({ payment_url: paymentUrl, transaction_id: transactionId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur paiement FedaPay." });
  }
});

router.post("/fedapay/callback", async (req, res) => {
  const { id, status } = req.body;
  if (status !== "approved") return res.json({ received: true });
  try {
    const sub = await db.query(
      "SELECT * FROM subscriptions WHERE payment_ref = $1", [String(id)]
    );
    if (sub.rows.length === 0) return res.json({ received: true });
    const { user_id, plan, billing_cycle } = sub.rows[0];
    const days = billing_cycle === "yearly" ? 365 : 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.query(
      "UPDATE subscriptions SET status = 'active', expires_at = $1 WHERE payment_ref = $2",
      [expiresAt, String(id)]
    );
    await db.query(
      "UPDATE users SET plan = $1, is_premium = TRUE, plan_expires_at = $2 WHERE id = $3",
      [plan, expiresAt, user_id]
    );
  } catch (err) {
    console.error(err.message);
  }
  res.json({ received: true });
});

router.get("/my-subscriptions", authMW, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, plan, billing_cycle, amount, payment_method, status, expires_at
       FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;