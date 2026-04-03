import cors from "cors";
import "dotenv/config";
import type { Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import cron from "node-cron";
import path from "path";
import { Server } from "socket.io";
import prisma from "./models/index.js";
import bookingRoutes from "./routes/bookingRoute.js";
import campaignRoutes from "./routes/campaignRoute.js";
import chatRoutes from "./routes/chatRoute.js";
import donationRoutes from "./routes/donationRoute.js";
import donorRoutes from "./routes/donorRoute.js";
import emergencyRoutes from "./routes/emergencyRoute.js";
import notificationRoutes from "./routes/notificationRoute.js";
import organizationRoutes from "./routes/organizationRoute.js";
import paymentRoutes from "./routes/paymentRoute.js";
import requestRoutes from "./routes/requestRoute.js";
import userRoutes from "./routes/userRoute.js";


const app = express();
const httpServer = createServer(app);


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// Socket.io initialization
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"]
  }
});

// Track online users
const onlineUsers = new Map<string, string>(); // userId -> socketId

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Allow users to join a room with their userId for targeted messages/notifications
  socket.on("join", (userId) => {
    if (userId) {
      const normalizedId = userId.toLowerCase();
      socket.join(normalizedId);
      onlineUsers.set(normalizedId, socket.id);
      console.log(`User ${normalizedId} joined room ${normalizedId}`);

      // Broadcast online status update if needed
      io.emit("userStatusUpdate", { userId: normalizedId, status: "online" });
    }
  });

  // Handle private messages
  socket.on("privateMessage", ({ receiverId, message, senderId, senderName }) => {
    const normalizedReceiverId = receiverId.toLowerCase();
    const normalizedSenderId = senderId.toLowerCase();
    console.log(`Message from ${normalizedSenderId} to ${normalizedReceiverId}: ${message}`);
    io.to(normalizedReceiverId).emit("newMessage", {
      senderId: normalizedSenderId,
      senderName,
      message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    let disconnectedUserId: string | undefined;

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      const normalizedId = disconnectedUserId.toLowerCase();
      io.emit("userStatusUpdate", { userId: normalizedId, status: "offline" });
    }
  });
});

// Make io and onlineUsers accessible to our routers
app.use((req, res, next) => {
  req.app.set('socketio', io);
  req.app.set('onlineUsers', onlineUsers);
  next();
});

export { io };

// Routes
app.get("/", async (req: Request, res: Response) => {
  res.send("This is the backend of bloodbuddy");
});

app.use("/api/users", userRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use("/api/chat", chatRoutes);


// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});


// Load port from .env or fallback to 3000
const PORT = process.env.PORT || 3000;

// Setup cron job to delete old bookings every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running 24h cleanup job...");
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    // First delete child DonorResponse records for old requests
    const oldRequestIds = await prisma.bloodRequest.findMany({
      where: { RequestDate: { lt: twentyFourHoursAgo } },
      select: { RequestId: true },
    });

    if (oldRequestIds.length > 0) {
      const ids = oldRequestIds.map(r => r.RequestId);

      await prisma.donorResponse.deleteMany({
        where: { RequestId: { in: ids } },
      });

      const result = await prisma.bloodRequest.deleteMany({
        where: { RequestId: { in: ids } },
      });

      console.log(`Cleaned up ${result.count} old booking requests.`);
    }
  } catch (error) {
    console.error("Error in cleanup job:", error);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});