const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/matches", require("./routes/matches"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/admin", require("./routes/admin"));

app.get("/", (req, res) => {
  res.json({
    app: "DJANDJOU 3.0 API",
    status: "✅ En ligne",
    version: "1.0.0",
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Erreur :", err.message);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 DJANDJOU API démarrée sur le port ${PORT}`);
});
