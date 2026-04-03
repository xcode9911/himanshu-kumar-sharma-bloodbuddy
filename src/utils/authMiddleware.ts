import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "bloodbuddysecret";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET as string);

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "user" in decoded &&
      typeof (decoded as any).user?.userId === "string" &&
      typeof (decoded as any).user?.role === "string"
    ) {
      req.user = (decoded as any).user;
      next();
    } else {
      return res.status(403).json({ message: "Invalid token payload" });
    }
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
