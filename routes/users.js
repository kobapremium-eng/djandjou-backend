const router = require("express").Router();
const db = require("../db");
const authMW = require("../middleware/auth");

router.get("/me", authMW, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, email, gender, looking_for, bio,
              city, country, profile_type, avatar_url,
              is_verified, is_premium, plan, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.put("/me", authMW, async (req, res) => {
  const { full_name, bio, city, country, gender, looking_for, profile_type, lifestyle } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET
        full_name    = COALESCE($1, full_name),
        bio          = COALESCE($2, bio),
        city         = COALESCE($3, city),
        country      = COALESCE($4, country),
        gender       = COALESCE($5, gender),
        looking_for  = COALESCE($6, looking_for),
        profile_type = COALESCE($7, profile_type),
        lifestyle    = COALESCE($8, lifestyle),
        updated_at   = NOW()
       WHERE id = $9
       RETURNING id, full_name, bio, city, country`,
      [full_name, bio, city, country, gender, looking_for, profile_type, lifestyle, req.userId]
    );
    res.json({ message: "Profil mis à jour ✓", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

router.get("/discover", authMW, async (req, res) => {
  const { type, limit = 20 } = req.query;
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.bio, u.city, u.country,
              u.profile_type, u.lifestyle, u.avatar_url,
              u.is_premium, u.plan,
              EXTRACT(YEAR FROM AGE(u.birth_date))::int AS age
       FROM users u
       WHERE u.id != $1
         AND u.status = 'active'
         AND u.is_verified = TRUE
         AND u.id NOT IN (SELECT to_user FROM likes WHERE from_user = $1)
         AND ($2::text IS NULL OR u.profile_type = $2)
       ORDER BY u.is_premium DESC, u.last_seen_at DESC
       LIMIT $3`,
      [req.userId, type || null, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;