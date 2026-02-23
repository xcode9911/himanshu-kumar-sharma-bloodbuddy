import type { Request, Response } from 'express';
import prisma from '../models/index.js';

/**
 * Send a message and save to database
 */
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { receiverId, message } = req.body;
        const senderId = (req as any).user.userId;

        if (!receiverId || !message) {
            return res.status(400).json({ message: 'ReceiverId and message are required' });
        }

        const newMessage = await prisma.chat.create({
            data: {
                SenderId: senderId,
                ReceiverId: receiverId,
                Message: message,
                Status: 'sent'
            }
        });

        // We rely on socket.io to emit the message in real-time, 
        // but the API call ensures it's persisted and provides immediate feedback.
        return res.status(201).json({
            message: 'Message sent successfully',
            data: newMessage
        });
    } catch (error: any) {
        console.error('Error sending message:', error);
        return res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};

/**
 * Get message history between two users
 */
export const getMessages = async (req: Request, res: Response) => {
    try {
        const { partnerId } = req.params;
        const userId = (req as any).user.userId;

        const messages = await prisma.chat.findMany({
            where: {
                OR: [
                    { SenderId: userId as string, ReceiverId: partnerId as string },
                    { SenderId: partnerId as string, ReceiverId: userId as string }
                ]
            },
            orderBy: {
                Timestamp: 'asc'
            }
        });

        const onlineUsers = req.app.get('onlineUsers') as Map<string, string> || new Map();
        const isOnline = onlineUsers.has(partnerId?.toString().toLowerCase() || "");

        return res.status(200).json({
            message: 'Messages retrieved successfully',
            messages,
            isOnline
        });
    } catch (error: any) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};

/**
 * Get contacts based on user role and chat history
 * - Donor: All Organizations + Gainers who messaged them
 * - Organization: All Donors + Gainers who messaged them
 * - Gainer: Anyone they have texted
 */
export const getChatPartners = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        // 1. Get all users I have chatted with
        const chatHistory = await prisma.chat.findMany({
            where: {
                OR: [
                    { SenderId: userId as string },
                    { ReceiverId: userId as string }
                ]
            },
            select: {
                SenderId: true,
                ReceiverId: true
            }
        });

        const partnerIds = new Set<string>();
        chatHistory.forEach(chat => {
            if (chat.SenderId !== userId) partnerIds.add(chat.SenderId as string);
            if (chat.ReceiverId !== userId) partnerIds.add(chat.ReceiverId as string);
        });

        const contactedUsers = await prisma.user.findMany({
            where: {
                UserId: { in: Array.from(partnerIds) }
            },
            select: {
                UserId: true,
                FullName: true,
                Email: true,
                Role: true,
                organization: {
                    select: {
                        OrganizationName: true
                    }
                }
            }
        });

        const onlineUsers = req.app.get('onlineUsers') as Map<string, string> || new Map();

        const enrichPartner = async (u: any) => {
            const isOnline = onlineUsers.has(u.UserId.toLowerCase());

            const lastMsg = await prisma.chat.findFirst({
                where: {
                    OR: [
                        { SenderId: userId as string, ReceiverId: u.UserId },
                        { SenderId: u.UserId, ReceiverId: userId as string }
                    ]
                },
                orderBy: { Timestamp: 'desc' },
                select: {
                    Message: true,
                    Timestamp: true
                }
            });

            const unread = await prisma.chat.count({
                where: {
                    SenderId: u.UserId,
                    ReceiverId: userId as string,
                    Status: 'sent'
                }
            });

            return {
                ...u,
                organizationName: u.organization?.OrganizationName || null,
                lastMessage: lastMsg?.Message || null,
                lastMessageTime: lastMsg?.Timestamp || null,
                unreadCount: unread,
                isOnline: isOnline
            };
        };

        // Logic based on role
        if (role === 'donor') {
            // All Organizations
            const organizations = await prisma.user.findMany({
                where: { Role: 'organization' },
                select: {
                    UserId: true,
                    FullName: true,
                    Email: true,
                    Role: true,
                    organization: {
                        select: {
                            OrganizationName: true
                        }
                    }
                }
            });
            // Gainers who messaged me
            const gainersFromHistory = contactedUsers.filter(u => u.Role === 'gainer');

            const enrichedOrgs = await Promise.all(organizations.map(enrichPartner));
            const enrichedGainers = await Promise.all(gainersFromHistory.map(enrichPartner));

            return res.status(200).json({
                organizations: enrichedOrgs,
                gainers: enrichedGainers
            });
        }

        if (role === 'organization') {
            // All Donors
            const donors = await prisma.user.findMany({
                where: { Role: 'donor' },
                select: {
                    UserId: true,
                    FullName: true,
                    Email: true,
                    Role: true,
                    organization: {
                        select: {
                            OrganizationName: true
                        }
                    }
                }
            });
            // Gainers who messaged me
            const gainersFromHistory = contactedUsers.filter(u => u.Role === 'gainer');

            const enrichedDonors = await Promise.all(donors.map(enrichPartner));
            const enrichedGainers = await Promise.all(gainersFromHistory.map(enrichPartner));

            return res.status(200).json({
                donors: enrichedDonors,
                gainers: enrichedGainers
            });
        }

        if (role === 'gainer') {
            // Everyone I talked to
            const enrichedContacts = await Promise.all(contactedUsers.map(enrichPartner));
            return res.status(200).json({
                contacts: enrichedContacts
            });
        }

        return res.status(400).json({ message: 'Invalid role' });
    } catch (error: any) {
        console.error('Error fetching chat partners:', error);
        return res.status(500).json({ message: 'Error fetching chat partners', error: error.message });
    }
};
/**
 * Mark all messages from a partner as read
 */
export const markMessagesAsRead = async (req: Request, res: Response) => {
    try {
        const { partnerId } = req.params;
        const userId = (req as any).user.userId;

        await prisma.chat.updateMany({
            where: {
                SenderId: partnerId as string,
                ReceiverId: userId as string,
                Status: 'sent'
            },
            data: {
                Status: 'read'
            }
        });

        // Notify the sender that their messages have been read
        const io = req.app.get('socketio');
        if (io && partnerId) {
            const normalizedPartnerId = partnerId.toString().toLowerCase();
            const normalizedUserId = userId.toString().toLowerCase();
            io.to(normalizedPartnerId).emit("messagesRead", { readerId: normalizedUserId });
        }

        return res.status(200).json({
            message: 'Messages marked as read'
        });
    } catch (error: any) {
        console.error('Error marking messages as read:', error);
        return res.status(500).json({ message: 'Error marking messages as read', error: error.message });
    }
};
