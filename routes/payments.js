const router = require("express").Router();
const db = require("../db");
const authMW = require("../middleware/auth");

const PLANS = {
  premium: { monthly: 4900, yearly: 49000 },
  vip: { monthly: 12500, yearly: 120000 },
};

router.post("/notchpay/create", authMW, async (req, res) => {
  const { plan, billing_cycle, email, phone } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Plan invalide." });
  const amount = PLANS[plan][billing_cycle || "monthly"];
  try {
    const user = await db.query(
      "SELECT email, full_name FROM users WHERE id = $1", [req.userId]
    );
    const response = await fetch("https://api.notchpay.co/payments/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.NOTCHPAY_PUBLIC_KEY,
      },
      body: JSON.stringify({
        amount,
        currency: "XAF",
        email: user.rows[0].email,
        phone: phone || "",
        reference: `djandjou_${req.userId}_${Date.now()}`,
        callback: `${process.env.API_URL}/api/payments/notchpay/callback`,
        description: `DJANDJOU 3.0 — ${plan} (${billing_cycle})`,
      }),
    });
    const data = await response.json();
    if (!data.transaction)
      return res.status(500).json({ error: "Erreur Notchpay." });
    await db.query(
      `INSERT INTO subscriptions (user_id, plan, billing_cycle, amount, payment_method, payment_ref, status)
       VALUES ($1, $2, $3, $4, 'notchpay', $5, 'pending')`,
      [req.userId, plan, billing_cycle, amount, data.transaction.reference]
    );
    res.json({ payment_url: data.authorization_url, reference: data.transaction.reference });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur lors du paiement." });
  }
});

router.post("/notchpay/callback", async (req, res) => {
  const { reference, status } = req.body;
  if (status !== "complete") return res.json({ received: true });
  try {
    const sub = await db.query(
      "SELECT * FROM subscriptions WHERE payment_ref = $1", [reference]
    );
    if (sub.rows.length === 0) return res.json({ received: true });
    const { user_id, plan, billing_cycle } = sub.rows[0];
    const days = billing_cycle === "yearly" ? 365 : 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.query(
      "UPDATE subscriptions SET status = 'active', expires_at = $1 WHERE payment_ref = $2",
      [expiresAt, reference]
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