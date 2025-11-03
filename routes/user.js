// routes/user.js
import express from "express";
import pool from "../config/database.js";
import crypto from "crypto";

const router = express.Router();

// --- User login ---
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const [results] = await pool.query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const user = results[0];
    const hashedPassword = crypto
      .createHash("md5")
      .update(password)
      .digest("hex");

    if (hashedPassword !== user.password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({
      success: true,
      admin_name: user.admin_name,
      employee_id: user.employee_id,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Add new admin ---
router.post("/admins", async (req, res) => {
  const { employee_id, admin_name, username, password } = req.body;

  if (!employee_id || !admin_name || !username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // check if username already exists
    const [results] = await pool.query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    if (results.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    // hash password with MD5
    const hashedPassword = crypto
      .createHash("md5")
      .update(password)
      .digest("hex");

    const [insertResult] = await pool.query(
      "INSERT INTO admins (employee_id, admin_name, username, password) VALUES (?, ?, ?, ?)",
      [employee_id, admin_name, username, hashedPassword]
    );

    res.status(201).json({
      id: insertResult.insertId,
      employee_id,
      admin_name,
      username,
    });
  } catch (err) {
    console.error("❌ Add user error:", err);
    res.status(500).json({ error: "Failed to add user" });
  }
});

// --- Get all admins ---
router.get("/admins", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM admins");
    res.json(results);
  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// --- Delete admin ---
router.delete("/admins/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM admins WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
