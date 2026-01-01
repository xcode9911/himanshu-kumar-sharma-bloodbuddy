import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import userRoutes from "./routes/userRoute.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", async (req: Request, res: Response) => {
  res.send("This is the backend of bloodbuddy");
});

app.use("/api/users", userRoutes);

// Load port from .env or fallback to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});