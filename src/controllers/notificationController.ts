import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

const getUserIdFromAuthHeader = (req: Request): { userId: string | null; error?: 'missing' | 'invalid' } => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return { userId: null, error: 'missing' };
    }

    const [, token] = authHeader.split(' ');
    if (!token) {
        return { userId: null, error: 'invalid' };
    }
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        return { userId: decoded?.user?.userId ?? null };
    } catch (err) {
        return { userId: null, error: 'invalid' };
    }
};

export const getNotifications = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const notifications = await prisma.notification.findMany({
            where: { UserId: authUserId },
            orderBy: { CreatedAt: 'desc' },
            take: 50
        });

        return res.status(200).json({ notifications });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        await prisma.notification.update({
            where: {
                NotificationId: parseInt(notificationId),
                UserId: authUserId // Ensure user owns the notification
            },
            data: { IsRead: true }
        });

        return res.status(200).json({ message: 'Notification marked as read' });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        await prisma.notification.updateMany({
            where: { UserId: authUserId, IsRead: false },
            data: { IsRead: true }
        });

        return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const deleteNotification = async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        await prisma.notification.delete({
            where: {
                NotificationId: parseInt(notificationId),
                UserId: authUserId
            }
        });

        return res.status(200).json({ message: 'Notification deleted' });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Helper function to create notifications (internal use)
export const createNotification = async (userId: string, title: string, message: string, type: string, relatedId?: number) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                UserId: userId,
                Title: title,
                Message: message,
                Type: type,
                RelatedId: relatedId
            }
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};
