import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// Helper: convert "HH:MM" or "HH:MM:SS" to seconds
function timeStringToSeconds(t) {
  if (!t) return null;
  const parts = t.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) parts.push(0);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [hh, mm, ss] = parts;
  return hh * 3600 + mm * 60 + ss;
}

// ======================================
// ✅ GET Attendance Report
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
    WHERE
      status <> 'Absent'
      OR (status = 'Absent' AND CURTIME() >= '17:00:00')
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
// ✅ PUT: Update time_out + working_hours
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

// ======================================
// ✅ PUT: Update time_in + auto update status + recalc working_hours
// ======================================
router.put("/attendance/:id/time-in", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_in } = req.body;

  try {
    // Get current record
    const [rows] = await pool.query(
      "SELECT time_out FROM attendance WHERE id = ?",
      [attendanceId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const timeOut = rows[0].time_out;
    let newStatus = "Absent";
    let newWorkingHours = null;

    // No time_in means Absent
    if (!time_in) {
      newStatus = "Absent";
      newWorkingHours = null;
    } else {
      // Normalize time format
      let normalizedTimeIn = time_in;
      if (/^\d{1,2}:\d{2}$/.test(time_in)) normalizedTimeIn = `${time_in}:00`;

      const timeInSeconds = timeStringToSeconds(normalizedTimeIn);
      if (timeInSeconds === null) {
        return res
          .status(400)
          .json({ error: "Invalid time_in format. Use 'HH:MM' or 'HH:MM:SS'." });
      }

      const cutoffSeconds = timeStringToSeconds("08:15:00");
      newStatus = timeInSeconds > cutoffSeconds ? "Late" : "Present";

      // Compute working hours if time_out exists
      if (timeOut) {
        const timeOutStr = typeof timeOut === "string" ? timeOut : null;
        const timeOutSeconds = timeStringToSeconds(timeOutStr);
        if (timeOutSeconds !== null) {
          let secondsDiff = timeOutSeconds - timeInSeconds;
          if (secondsDiff < 0) secondsDiff = 0;
          newWorkingHours = Math.round((secondsDiff / 3600) * 100) / 100;
        }
      }

      req.body._normalizedTimeIn = normalizedTimeIn;
    }

    // Update database
    const updateSql = `
      UPDATE attendance
      SET time_in = ?, status = ?, working_hours = ?
      WHERE id = ?
    `;

    const timeInForDb =
      !time_in || time_in === "" ? null : req.body._normalizedTimeIn;

    const [updateResult] = await pool.query(updateSql, [
      timeInForDb,
      newStatus,
      newWorkingHours,
      attendanceId,
    ]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Record not updated" });
    }

    // Return updated record
    const [updated] = await pool.query(
      `
      SELECT id AS attendance_id, employee_id, fullname, date, temperature, time_in, time_out, status, working_hours
      FROM attendance WHERE id = ?
      `,
      [attendanceId]
    );

    console.log(
      `✅ Updated #${attendanceId} → time_in=${timeInForDb}, status=${newStatus}, working_hours=${newWorkingHours}`
    );

    res.json({
      message: "✅ time_in, status, and working_hours updated",
      attendance: updated[0],
    });
  } catch (err) {
    console.error("❌ Error updating time_in:", err);
    res.status(500).json({ error: "Failed to update time_in" });
  }
});

export default router;
