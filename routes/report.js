// routes/report.js
import express from "express";
import pool from "../config/database.js"; // ES Module import

const router = express.Router();

// ==============================
// GET: Attendance Reports (with Absentees + Date Range Filter)
// ==============================
router.get("/attendance", async (req, res) => {
  const { from, to } = req.query;

  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const sql = `
    SELECT 
      e.employee_id,
      e.fullname,
      a.id AS attendance_id,
      a.date,
      a.temperature,
      a.time_in,
      a.time_out,
      a.status,
      CASE
        WHEN a.employee_id IS NULL THEN 'Absent'
        WHEN TIME(a.time_in) > '08:15' THEN 'Late'
        WHEN TIME(a.time_in) <= '07:59' THEN 'Early In'
        ELSE 'On Time'
      END AS in_status,
      CASE
        WHEN a.employee_id IS NULL THEN 'Absent'
        WHEN TIME(a.time_out) < '17:00' THEN 'Early Out'
        WHEN TIME(a.time_out) > '18:00' THEN 'Overtime'
        ELSE 'On Time'
      END AS out_status,
      ROUND(TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in)) / 3600, 2) AS working_hours
    FROM employees e
    LEFT JOIN attendance a 
      ON e.employee_id = a.employee_id
      AND a.date BETWEEN ? AND ?
    ORDER BY e.employee_id ASC, a.date DESC
  `;

  try {
    const [results] = await pool.query(sql, [fromDate, toDate]);
    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching report data:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ==============================
// PUT: Update Attendance (time_out & working_hours)
// ==============================
router.put("/attendance/:id", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_in, time_out, working_hours } = req.body;

  if (!time_in || !time_out || working_hours === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    UPDATE attendance 
    SET time_in = ?, time_out = ?, working_hours = ?
    WHERE id = ?
  `;

  try {
    const [result] = await pool.query(sql, [time_in, time_out, working_hours, attendanceId]);

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
