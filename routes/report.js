// routes/report.js
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// ======================================
// ✅ GET: Attendance Report (Filtered)
// ======================================
router.get("/attendance", async (req, res) => {
  const sql = `
    SELECT 
      id AS attendance_id,
      employee_id, 
      fullname, 
      date, 
      temperature,
      time_in,
      time_out,
      -- ✅ Determine Status (only Present, Late, Absent)
      CASE 
        WHEN time_in IS NULL AND CURTIME() >= '17:00:00' THEN 'Absent'
        WHEN TIME(time_in) > '08:15' THEN 'Late'
        ELSE 'Present'
      END AS status,
      -- ✅ Compute working hours safely
      CASE
        WHEN time_in IS NOT NULL AND time_out IS NOT NULL
        THEN ROUND(TIME_TO_SEC(TIMEDIFF(time_out, time_in)) / 3600, 2)
        ELSE NULL
      END AS working_hours
    FROM attendance
    WHERE 
      -- ✅ Include only Present or Late
      time_in IS NOT NULL
      OR
      -- ✅ Include Absent only if after 5 PM
      (time_in IS NULL AND CURTIME() >= '17:00:00')
    ORDER BY id DESC
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
// ✅ PUT: Update Attendance (time_out, working_hours)
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
