// routes/report-fixes.js
import express from "express";
import pool from "../config/database.js"; // same pool you're using

const router = express.Router();

/**
 * GET /attendance/full?date=YYYY-MM-DD
 * Returns all employees for a given date (default = today) and their attendance (if any).
 * - If no attendance row or time_in is null -> status = 'Absent'
 * - If time_in <= '08:00:00' -> status = 'Present'
 * - If time_in >  '08:00:00' -> status = 'Late'
 *
 * Also computes in_status/out_status and working_hours when present.
 */
router.get("/attendance/full", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const sql = `
      SELECT
        e.id AS employee_id,
        e.fullname,
        a.id AS attendance_id,
        a.date,
        a.temperature,
        a.time_in,
        a.time_out,
        -- Overall status: Absent / Present / Late
        CASE
          WHEN a.id IS NULL THEN 'Absent'
          WHEN a.time_in IS NULL THEN 'Absent'
          WHEN TIME(a.time_in) > '08:00:00' THEN 'Late'
          ELSE 'Present'
        END AS status,
        -- Dynamic IN Status (kept for compatibility)
        CASE
          WHEN a.time_in IS NULL THEN NULL
          WHEN TIME(a.time_in) > '08:15:00' THEN 'Late'
          WHEN TIME(a.time_in) <= '07:59:00' THEN 'Early In'
          ELSE 'On Time'
        END AS in_status,
        -- Dynamic OUT Status (kept for compatibility)
        CASE
          WHEN a.time_out IS NULL THEN NULL
          WHEN TIME(a.time_out) < '17:00:00' THEN 'Early Out'
          WHEN TIME(a.time_out) > '18:00:00' THEN 'Overtime'
          ELSE 'On Time'
        END AS out_status,
        -- Calculate working hours only if both times exist
        CASE
          WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL
            THEN ROUND(TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in)) / 3600, 2)
          ELSE NULL
        END AS working_hours
      FROM employees e
      LEFT JOIN attendance a
        ON a.employee_id = e.id
        AND a.date = ?
      ORDER BY e.fullname
    `;

    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching full attendance:", err);
    res.status(500).json({ error: "Failed to fetch full attendance" });
  }
});

/**
 * PUT /attendance/:id/recalculate
 * Recalculate status and working_hours for a single attendance record.
 * Useful after editing time_in/time_out so DB status field matches new times.
 *
 * Behavior:
 * - If attendance row missing -> 404
 * - If time_in is null -> status = 'Absent', working_hours = NULL
 * - else if time_in > '08:00:00' -> status = 'Late'
 * - else status = 'Present'
 * - working_hours computed if both times exist (NULL otherwise)
 */
router.put("/attendance/:id/recalculate", async (req, res) => {
  const attendanceId = req.params.id;

  try {
    // fetch existing times
    const [rows] = await pool.query(
      `SELECT time_in, time_out FROM attendance WHERE id = ? LIMIT 1`,
      [attendanceId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const { time_in, time_out } = rows[0];

    // Determine new status
    let status;
    if (!time_in) {
      status = "Absent";
    } else {
      // Compare only time-of-day portion
      // If time_in is greater than 08:00:00 -> Late, else Present
      status = `(CASE WHEN TIME(?) > '08:00:00' THEN 'Late' ELSE 'Present' END)`;
      // We'll use a prepared UPDATE with the computed working_hours below
    }

    // Compute working_hours if both provided
    let workingHours = null;
    if (time_in && time_out) {
      const [whRows] = await pool.query(
        `SELECT ROUND(TIME_TO_SEC(TIMEDIFF(?, ?)) / 3600, 2) AS wh`,
        [time_out, time_in]
      );
      workingHours = whRows && whRows[0] ? whRows[0].wh : null;
    }

    if (!time_in) {
      // simple update: status = 'Absent', working_hours = NULL
      const [result] = await pool.query(
        `UPDATE attendance SET status = ?, working_hours = NULL WHERE id = ?`,
        ["Absent", attendanceId]
      );
      return res.json({ message: "✅ Recalculated: marked Absent (no time_in)" });
    }

    // If time_in exists, set status based on time_in and working_hours accordingly.
    // Use a single UPDATE that sets status using TIME(?) comparison to avoid round-trip JS time parsing.
    const updateSql = `
      UPDATE attendance
      SET status = CASE WHEN TIME(?) > '08:00:00' THEN 'Late' ELSE 'Present' END,
          working_hours = ?
      WHERE id = ?
    `;
    const [updateResult] = await pool.query(updateSql, [time_in, workingHours, attendanceId]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found during update" });
    }

    res.json({ message: "✅ Recalculated status and working hours", working_hours: workingHours });
  } catch (err) {
    console.error("❌ Error recalculating attendance:", err);
    res.status(500).json({ error: "Failed to recalculate attendance" });
  }
});

export default router;

