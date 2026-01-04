import express from "express";
import pool from "../config/database.js";
import crypto from "crypto";
import sendEmail from "../utils/mailer.js";

const router = express.Router();

/* ================= CREATE ADMIN + OTP ================= */
router.post("/admins", async (req, res) => {
  const { employee_id, admin_name, username, position } = req.body;

  if (!employee_id || !admin_name || !username || !position) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const [existing] = await pool.query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Username already exists" });
    }

    // 🔐 OTP
    const tempPassword = crypto.randomBytes(4).toString("hex");
    console.log("🔑 OTP generated:", tempPassword);

    const hashedPassword = crypto
      .createHash("md5")
      .update(tempPassword)
      .digest("hex");

    await pool.query(
      "INSERT INTO admins (employee_id, admin_name, username, password, role) VALUES (?, ?, ?, ?, ?)",
      [employee_id, admin_name, username, hashedPassword, position]
    );

    // 📧 SEND EMAIL (DO NOT FAIL USER CREATION)
    try {
      await sendEmail({
        to: username,
        subject: "Your One-Time Password",
        html: `
          <p>Hello <b>${admin_name}</b>,</p>
          <p>Your account has been created.</p>
          <p><b>One-Time Password:</b></p>
          <h2>${tempPassword}</h2>
          <p>Please change your password after logging in.</p>
        `,
      });
    } catch (emailErr) {
      console.error("⚠️ Email failed but user created:", emailErr.message);
    }

    res.status(201).json({
      message: "User created successfully",
      employee_id,
      admin_name,
      username,
    });
  } catch (err) {
    console.error("❌ Add admin error:", err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const user = rows[0];

    // Hash the password from login to compare with DB
    const hashedPassword = crypto.createHash("md5").update(password).digest("hex");

    if (user.password !== hashedPassword) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    res.json({
      success: true,
      admin_name: user.admin_name,
      employee_id: user.employee_id,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
