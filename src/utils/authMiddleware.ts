import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

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

export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded: any = jwt.verify(token, JWT_SECRET as string);
        // Structure of decoded token from userController is { user: { userId, role, ... } }
        if (decoded && decoded.user) {
            req.user = decoded.user;
            next();
        } else {
            return res.status(403).json({ message: 'Invalid token payload' });
        }
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
