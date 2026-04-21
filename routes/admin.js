const router = require("express").Router();
const db = require("../db");
const authMW = require("../middleware/auth");

router.get("/stats", authMW, async (req, res) => {
  try {
    const [users, revenue, reports, matches] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE status = 'active'"),
      db.query("SELECT COALESCE(SUM(amount),0) AS total FROM subscriptions WHERE status = 'active'"),
      db.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) FROM matches"),
    ]);
    res.json({
      active_users:    parseInt(users.rows[0].count),
      total_revenue:   parseInt(revenue.rows[0].total),
      pending_reports: parseInt(reports.rows[0].count),
      total_matches:   parseInt(matches.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/users", authMW, async (req, res) => {
  const { search, status, plan } = req.query;
  try {
    let query = `
      SELECT u.id, u.full_name, u.email, u.country,
             u.profile_type, u.plan, u.status,
             u.is_verified, u.is_premium, u.created_at,
             EXTRACT(YEAR FROM AGE(u.birth_date))::int AS age,
             (SELECT COUNT(*) FROM reports WHERE target_id = u.id)::int AS report_count
      FROM users u WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (search) {
      query += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (status) { query += ` AND u.status = $${idx}`; params.push(status); idx++; }
    if (plan)   { query += ` AND u.plan = $${idx}`;   params.push(plan);   idx++; }
    query += " ORDER BY u.created_at DESC LIMIT 100";
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.patch("/users/:id", authMW, async (req, res) => {
  const { status, is_profile_verified, plan } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET
         status              = COALESCE($1, status),
         is_profile_verified = COALESCE($2, is_profile_verified),
         plan                = COALESCE($3, plan),
         updated_at          = NOW()
       WHERE id = $4
       RETURNING id, full_name, status, plan`,
      [status, is_profile_verified, plan, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    res.json({ message: "Mis à jour ✓", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/reports", authMW, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.reason, r.severity, r.status, r.created_at,
              ru.full_name AS reporter_name,
              tu.full_name AS target_name
       FROM reports r
       JOIN users ru ON r.reporter_id = ru.id
       JOIN users tu ON r.target_id = tu.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.patch("/reports/:id", authMW, async (req, res) => {
  const { status } = req.body;
  try {
    await db.query(
      "UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );
    res.json({ message: "Signalement mis à jour ✓" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/payments", authMW, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.plan, s.amount, s.payment_method,
              s.status, s.created_at, u.full_name, u.email
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;