import express from "express";
import pool from "../config/database.js";

const router = express.Router();

/**
 * MONTHLY ATTENDANCE SUMMARY
 * GET /api/attendance/summary?month=YYYY-MM
 */
router.get("/attendance/summary", async (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ error: "Month is required (YYYY-MM)" });
  }

  const sql = `
    SELECT
      employee_id,
      fullname,
      COUNT(CASE WHEN status IN ('Present','Late') THEN 1 END) AS days_present,
      COUNT(CASE WHEN status = 'Late' THEN 1 END) AS late_count,
      COUNT(CASE WHEN status = 'Absent' THEN 1 END) AS absences,
      ROUND(SUM(COALESCE(working_hours, 0)), 2) AS total_hours
    FROM attendance
    WHERE DATE_FORMAT(date, '%Y-%m') = ?
    GROUP BY employee_id, fullname
    ORDER BY fullname
  `;

  try {
    const [rows] = await pool.query(sql, [month]);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching summary:", err);
    res.status(500).json({ error: "Failed to fetch attendance summary" });
  }
});

export default router;
