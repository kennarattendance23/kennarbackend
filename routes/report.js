import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function timeStringToSeconds(t) {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.length === 2) parts.push(0);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [hh, mm, ss] = parts;
  return hh * 3600 + mm * 60 + ss;
}


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
    ORDER BY date DESC, id DESC
  `;

  try {
    const [results] = await pool.query(sql);
    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching attendance:", err);
    res.status(500).json({ error: "Failed to fetch attendance report" });
  }
});


router.put("/attendance/:id", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_out, working_hours } = req.body;

  if (!time_out || working_hours === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE attendance
      SET time_out = ?, working_hours = ?
      WHERE id = ?
      `,
      [time_out, working_hours, attendanceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    res.json({ message: "✅ Attendance updated successfully" });
  } catch (err) {
    console.error("❌ Error updating attendance:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});


router.put("/attendance/:id/time-in", async (req, res) => {
  const attendanceId = req.params.id;
  const { time_in } = req.body;

  try {
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

    if (time_in) {
      let normalized = time_in;
      if (/^\d{1,2}:\d{2}$/.test(time_in)) {
        normalized = `${time_in}:00`;
      }

      const timeInSec = timeStringToSeconds(normalized);
      if (timeInSec === null) {
        return res.status(400).json({
          error: "Invalid time format (HH:MM or HH:MM:SS)",
        });
      }

      const cutoff = timeStringToSeconds("08:15:00");
      newStatus = timeInSec > cutoff ? "Late" : "Present";

      if (timeOut) {
        const outSec = timeStringToSeconds(timeOut);
        if (outSec !== null) {
          let diff = outSec - timeInSec;
          if (diff < 0) diff = 0;
          newWorkingHours = Math.round((diff / 3600) * 100) / 100;
        }
      }

      req.body._normalizedTimeIn = normalized;
    }

    const [updateResult] = await pool.query(
      `
      UPDATE attendance
      SET time_in = ?, status = ?, working_hours = ?
      WHERE id = ?
      `,
      [
        time_in ? req.body._normalizedTimeIn : null,
        newStatus,
        newWorkingHours,
        attendanceId,
      ]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Record not updated" });
    }

    const [updated] = await pool.query(
      `
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
      WHERE id = ?
      `,
      [attendanceId]
    );

    res.json({
      message: "✅ Attendance updated",
      attendance: updated[0],
    });
  } catch (err) {
    console.error("❌ Error updating time_in:", err);
    res.status(500).json({ error: "Failed to update time_in" });
  }
});

export default router;
