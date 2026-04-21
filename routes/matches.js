const router = require("express").Router();
const db = require("../db");
const authMW = require("../middleware/auth");

router.post("/like", authMW, async (req, res) => {
  const { target_id, type = "like" } = req.body;
  if (!target_id) return res.status(400).json({ error: "ID cible requis." });
  if (target_id === req.userId) return res.status(400).json({ error: "Impossible de se liker soi-même." });
  try {
    await db.query(
      `INSERT INTO likes (from_user, to_user, type)
       VALUES ($1, $2, $3)
       ON CONFLICT (from_user, to_user) DO UPDATE SET type = $3`,
      [req.userId, target_id, type]
    );
    const mutual = await db.query(
      "SELECT id FROM likes WHERE from_user = $1 AND to_user = $2",
      [target_id, req.userId]
    );
    let isMatch = false;
    let matchId = null;
    if (mutual.rows.length > 0) {
      const matchResult = await db.query(
        `INSERT INTO matches (user1_id, user2_id)
         VALUES (LEAST($1::text,$2::text)::uuid, GREATEST($1::text,$2::text)::uuid)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [req.userId, target_id]
      );
      isMatch = true;
      matchId = matchResult.rows[0]?.id;
    }
    res.json({ liked: true, is_match: isMatch, match_id: matchId,
      message: isMatch ? "🎉 C'est un Match !" : "Like enregistré !" });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors du like." });
  }
});

router.get("/", authMW, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.id AS match_id, m.created_at AS matched_at,
              u.id, u.full_name, u.avatar_url, u.city,
              EXTRACT(YEAR FROM AGE(u.birth_date))::int AS age,
              (SELECT content FROM messages WHERE match_id = m.id
               ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM matches m
       JOIN users u ON (
         CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END = u.id
       )
       WHERE m.user1_id = $1 OR m.user2_id = $1
       ORDER BY m.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/:matchId/messages", authMW, async (req, res) => {
  try {
    const check = await db.query(
      "SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [req.params.matchId, req.userId]
    );
    if (check.rows.length === 0)
      return res.status(403).json({ error: "Accès non autorisé." });
    const result = await db.query(
      `SELECT m.id, m.sender_id, m.content, m.read, m.created_at,
              u.full_name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.match_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.matchId]
    );
    await db.query(
      "UPDATE messages SET read = TRUE WHERE match_id = $1 AND sender_id != $2",
      [req.params.matchId, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.post("/:matchId/messages", authMW, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "Message vide." });
  try {
    const check = await db.query(
      "SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [req.params.matchId, req.userId]
    );
    if (check.rows.length === 0)
      return res.status(403).json({ error: "Accès non autorisé." });
    const result = await db.query(
      `INSERT INTO messages (match_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING id, sender_id, content, created_at`,
      [req.params.matchId, req.userId, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;