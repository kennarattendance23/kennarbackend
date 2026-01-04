import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import db from "../config/database.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/:employee_id/image", async (req, res) => {
  const employeeId = req.params.employee_id;
  try {
    const [results] = await db.query("SELECT image, image_mime FROM employees WHERE employee_id = ?", [employeeId]);
    if (!results.length || !results[0].image) {
      return res.status(404).json({ error: "No image found for this employee" });
    }
    const imageData = results[0].image;
    const imageMime = results[0].image_mime || "image/jpeg";
    const base64Img = imageData.toString("base64");
    res.json({ base64: `data:${imageMime};base64,${base64Img}` });
  } catch (err) {
    console.error("❌ Database error fetching image:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM employees");
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      employee_id,
      name,
      mobile_phone,
      date_of_birth,
      status,
      face_embedding,
      fingerprint_id,
    } = req.body;

    if (!employee_id || !name) {
      return res.status(400).json({ error: "Employee ID and Name are required" });
    }

    let imageBuffer = null;
    let imageMime = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMime = req.file.mimetype;
    }

    const sql = `
      INSERT INTO employees 
      (employee_id, name, mobile_phone, date_of_birth, image, face_embedding, fingerprint_id, status, image_mime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(sql, [
      employee_id,
      name,
      mobile_phone || null,
      date_of_birth || null,
      imageBuffer,
      face_embedding || null,
      fingerprint_id || null,
      status || "Active",
      imageMime,
    ]);

    res.json({ message: "✅ Employee added successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "Employee ID already exists" });
    } else {
      console.error("❌ Error adding employee:", err);
      res.status(500).json({ error: "Database error" });
    }
  }
});

router.put("/:employee_id", upload.single("image"), async (req, res) => {
  try {
    const { employee_id } = req.params;
    const {
      name,
      mobile_phone,
      date_of_birth,
      status,
      face_embedding,
      fingerprint_id,
    } = req.body;

    let imageBuffer = null;
    let imageMime = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMime = req.file.mimetype;
    }

    let query = `
      UPDATE employees
      SET name=?, mobile_phone=?, date_of_birth=?, status=?, face_embedding=?, fingerprint_id=?`;
    const params = [
      name,
      mobile_phone || null,
      date_of_birth || null,
      status || "Active",
      face_embedding || null,
      fingerprint_id || null,
    ];

    if (imageBuffer) {
      query += `, image=?, image_mime=?`;
      params.push(imageBuffer, imageMime);
    }

    query += ` WHERE employee_id=?`;
    params.push(employee_id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "✅ Employee updated successfully" });
  } catch (err) {
    console.error("❌ Error updating employee:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    await db.query("DELETE FROM attendance WHERE employee_id = ?", [employee_id]);

    const [result] = await db.query("DELETE FROM employees WHERE employee_id = ?", [employee_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "✅ Employee deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting employee:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;