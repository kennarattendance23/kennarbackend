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
      status,
      working_hours
    FROM attendance
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
// ✅ PUT: Update Attendance (time_in, time_out)
// ✅ Automatically updates STATUS + WORKING HOURS
// ======================================
router.put("/attendance/:id", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_in, time_out } = req.body;

  try {
    // 1️⃣ Fetch existing record first
    const [rows] = await pool.query(`SELECT * FROM attendance WHERE id = ?`, [attendanceId]);
    if (rows.length === 0) return res.status(404).json({ error: "Attendance record not found" });

    const record = rows[0];

    // 2️⃣ Decide the new status based on time_in logic
    let newStatus = record.status;

    if (time_in) {
      // Convert time_in to compare
      if (time_in <= "08:15:00") newStatus = "Present";
      else newStatus = "Late";
    } else {
      // No time_in: check if it's already 5PM or later
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);

      if (currentTime >= "17:00:00") newStatus = "Absent";
    }

    // 3️⃣ Compute working hours only if both exist
    let workingHours = record.working_hours;
    if (time_in && time_out) {
      const [calc] = await pool.query(
        `SELECT ROUND(TIME_TO_SEC(TIMEDIFF(?, ?)) / 3600, 2) AS hours`,
        [time_out, time_in]
      );
      workingHours = calc[0].hours;
    }

    // 4️⃣ Update database
    const sql = `
      UPDATE attendance 
      SET time_in = ?, time_out = ?, status = ?, working_hours = ?
      WHERE id = ?
    `;

    await pool.query(sql, [time_in, time_out, newStatus, workingHours, attendanceId]);

    res.json({ message: "✅ Attendance updated successfully", newStatus, workingHours });

  } catch (err) {
    console.error("❌ Error updating attendance:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

export default router;
