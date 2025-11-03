import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { testConnection } from "./config/database.js";
import userRoutes from "./routes/user.js";
import dashboardRoutes from "./routes/Dashboard.js";
import employeeRoutes from "./routes/employee.js";
import reportRoutes from "./routes/report.js";
import path from "path";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ HTTP server for Socket.io
const server = http.createServer(app);

// ✅ Socket.io setup
const io = new Server(server, {
  cors: { origin: "*" },
});
io.on("connection", (socket) => {
  console.log("⚡ Kiosk connected:", socket.id);
});

// Make io available to routes
export { io };

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// ✅ Serve uploads (images) as static files
app.use("/uploads", express.static("uploads"));

// ✅ Mount routes
app.use("/api", userRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api", reportRoutes);

// ✅ DB connection check
testConnection();

app.get("/", (req, res) => {
  res.send("✅ Kennar Backend API is running successfully!");
});

// Use server.listen instead of app.listen for Socket.io
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Serve employee image BLOB as base64
app.get('/api/employees/:employee_id/image', (req, res) => {
  const employeeId = req.params.employee_id;
  pool.query('SELECT image FROM employees WHERE employee_id = ?', [employeeId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!results.length || !results[0].image) {
      return res.status(404).json({ error: 'No image found' });
    }
    const imgBuffer = results[0].image;
    let mimeType = 'image/jpeg';
    const base64Img = imgBuffer.toString('base64');
    res.json({ base64: `data:${mimeType};base64,${base64Img}` });
  });
});
