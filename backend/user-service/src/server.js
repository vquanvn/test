require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, initDb } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ service: "user-service", status: "ok" });
});

app.post("/users/register", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: "email, password, fullName are required" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, email, full_name, role, created_at`,
      [email, hashed, fullName]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (String(err.message).includes("duplicate key")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Failed to register", error: err.message });
  }
});

app.post("/users/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to login", error: err.message });
  }
});

app.get("/users/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
});

app.get("/users/:id", authRequired, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid user id" });
  if (req.user.role !== "admin" && req.user.id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, created_at FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch user", error: err.message });
  }
});

app.get("/users", authRequired, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, created_at FROM users ORDER BY id ASC"
    );
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ message: "Failed to list users", error: err.message });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`user-service listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize user-service", err);
    process.exit(1);
  });
