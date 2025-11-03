// routes/report.js
import express from "express";
import pool from "../config/database.js"; // ES Module import

const router = express.Router();

// ==============================
// GET: Attendance Reports
// ==============================
router.get("/attendance", async (req, res) => {
  const sql = `
    SELECT 
      id AS attendance_id,       -- map "id" to "attendance_id" for frontend
      employee_id, 
      fullname, 
      date, 
      temperature,
      time_in, 
      time_out,
      status,
      -- Dynamic IN Status
      CASE 
        WHEN TIME(time_in) > '08:15' THEN 'Late'
        WHEN TIME(time_in) <= '07:59' THEN 'Early In'
        ELSE 'On Time'
      END AS in_status,
      -- Dynamic OUT Status
      CASE 
        WHEN TIME(time_out) < '17:00' THEN 'Early Out'
        WHEN TIME(time_out) > '18:00' THEN 'Overtime'
        ELSE 'On Time'
      END AS out_status,
      -- Calculate working hours
      ROUND(TIME_TO_SEC(TIMEDIFF(time_out, time_in)) / 3600, 2) AS working_hours
    FROM attendance
    ORDER BY id DESC
  `;

  try {
    const [results] = await pool.query(sql);
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
