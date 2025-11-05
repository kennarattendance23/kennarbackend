import express from "express";
import db from "../config/db.js";

const router = express.Router();

// GET attendance report with absentees included
router.get("/report", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Date filter condition
    let dateCondition = "";
    let params = [];

    if (startDate && endDate) {
      dateCondition = "WHERE a.date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    // Get all dates from attendance
    const [dates] = await db.query(`
      SELECT DISTINCT date FROM attendance ORDER BY date DESC
    `);

    // Get all active employees
    const [employees] = await db.query(`
      SELECT employee_id, name FROM employees WHERE status = 'Active'
    `);

    let results = [];

    for (const d of dates) {
      const date = d.date;

      // Get attendance records for that date
      const [attended] = await db.query(
        `SELECT a.*, e.name AS fullname
         FROM attendance a
         JOIN employees e ON a.employee_id = e.employee_id
         WHERE a.date = ?`,
        [date]
      );

      // Get absentees by comparing all active employees with those who attended
      const attendedIDs = attended.map((a) => a.employee_id);
      const absentees = employees
        .filter((emp) => !attendedIDs.includes(emp.employee_id))
        .map((emp) => ({
          date,
          employee_id: emp.employee_id,
          fullname: emp.name,
          temperature: null,
          status: "Absent",
          time_in: null,
          time_out: null,
          working_hours: null,
        }));

      results.push(...attended, ...absentees);
    }

    // Apply date filter if provided
    if (startDate && endDate) {
      results = results.filter(
        (r) => r.date >= startDate && r.date <= endDate
      );
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

export default router;
