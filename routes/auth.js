const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");

const makeToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post("/register", async (req, res) => {
  const { full_name, email, password, gender, looking_for } = req.body;
  if (!full_name || !email || !password)
    return res.status(400).json({ error: "Nom, email et mot de passe requis." });
  if (!isValidEmail(email))
    return res.status(400).json({ error: "Email invalide." });
  if (password.length < 8)
    return res.status(400).json({ error: "Mot de passe trop court (8 caractères min)." });
  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Email déjà utilisé." });
    const password_hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (full_name, email, password_hash, gender, looking_for)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email`,
      [full_name.trim(), email.toLowerCase(), password_hash, gender || "other", looking_for || "everyone"]
    );
    res.status(201).json({
      message: "Compte créé ! Vérifiez votre email.",
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création du compte." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email et mot de passe requis." });
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1 AND status != 'deleted'",
      [email.toLowerCase()]
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    if (user.status === "suspended")
      return res.status(403).json({ error: "Compte suspendu." });
    await db.query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [user.id]);
    const token = makeToken(user.id);
    res.json({ token, user: { id: user.id, name: user.full_name, email: user.email, plan: user.plan } });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la connexion." });
  }
});

module.exports = router;