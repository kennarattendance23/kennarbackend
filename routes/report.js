// routes/report.js
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// ======================================
// ✅ GET: Attendance Report with Absentees
// ======================================
router.get("/attendance", async (req, res) => {
  const sql = `
    SELECT 
      e.employee_id,
      e.fullname,
      d.date,
      a.id AS attendance_id,
      a.temperature,
      a.time_in,
      a.time_out,
      -- ✅ Determine Status
      CASE 
        WHEN a.time_in IS NULL THEN 'Absent'
        WHEN TIME(a.time_in) > '08:15' THEN 'Late'
        ELSE 'Present'
      END AS status,
      -- ✅ Compute working hours safely
      CASE
        WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL
        THEN ROUND(TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in)) / 3600, 2)
        ELSE NULL
      END AS working_hours
    FROM employees e
    CROSS JOIN (
      SELECT DISTINCT date FROM attendance
    ) AS d
    LEFT JOIN attendance a 
      ON e.employee_id = a.employee_id AND a.date = d.date
    ORDER BY d.date DESC, e.employee_id;
  `;

  try {
    const [results] = await pool.query(sql);
    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching attendance:", err);
    res.status(500).json({ error: "Failed to fetch attendance report" });
  }
});

// ======================================
// ✅ PUT: Update Attendance
// ======================================
router.put("/attendance/:id", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_out, working_hours } = req.body;

  if (!time_out || working_hours === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    UPDATE attendance 
    SET time_out = ?, working_hours = ?
    WHERE id = ?
  `;

  try {
    const [result] = await pool.query(sql, [time_out, working_hours, attendanceId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    res.json({ message: "✅ Attendance updated successfully" });
  } catch (err) {
    console.error("❌ Error updating attendance:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

export default router;
