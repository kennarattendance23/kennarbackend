import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { testConnection } from "./config/database.js";
import userRoutes from "./routes/user.js";
import dashboardRoutes from "./routes/Dashboard.js";
import employeeRoutes from "./routes/employee.js";
import reportRoutes from "./routes/report.js";
import summaryRoutes from "./routes/summary.js";
import path from "path";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});
io.on("connection", (socket) => {
  console.log("⚡ Kiosk connected:", socket.id);
});

export { io };

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

app.use("/uploads", express.static("uploads"));

app.use("/api", userRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api", reportRoutes);
app.use("/api", summaryRoutes);



testConnection();

app.get("/", (req, res) => {
  res.send("✅ Kennar Backend API is running successfully!");
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});