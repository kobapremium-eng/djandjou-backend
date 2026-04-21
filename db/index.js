const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("connect", () => console.log("✅ Base de données connectée"));
pool.on("error", (err) => console.error("❌ Erreur DB :", err.message));

module.exports = pool;