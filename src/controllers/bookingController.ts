import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';
import { logInventoryChange } from '../utils/inventoryLogger.js';
import { createNotification } from './notificationController.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

// Extract userId from bearer token
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

export const createBooking = async (req: Request, res: Response) => {
    const { organizationId, bloodType, units } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { gainer: true },
        });

        if (!user || user.Role.toLowerCase() !== 'gainer' || !user.gainer) {
            return res.status(403).json({ message: 'Only gainers can create requests' });
        }

        const gainerId = user.gainer.GainerId;

        // Create the request as Pending
        const request = await prisma.bloodRequest.create({
            data: {
                GainerId: gainerId,
                OrganizationId: organizationId,
                BloodType: bloodType,
                Units: units,
                Status: 'Pending',
            },
            include: {
                gainer: {
                    include: {
                        user: {
                            select: { FullName: true }
                        }
                    }
                }
            }
        });

        // Notify organization via socket
        const io = req.app.get('socketio');
        if (io) {
            // Get organization user ID to notify specific room
            const org = await prisma.organization.findUnique({
                where: { OrganizationId: organizationId },
                select: { UserId: true }
            });

            const orgUserId = org?.UserId;
            if (io && orgUserId) {
                io.to(orgUserId).emit('newBookingRequest', {
                    requestId: request.RequestId,
                    gainerName: request.gainer.user.FullName,
                    bloodType: request.BloodType,
                    units: request.Units,
                    timestamp: request.RequestDate,
                });

                // Save persistent notification
                const notification = await createNotification(
                    orgUserId,
                    "New Blood Request",
                    `${request.gainer.user.FullName} needs ${request.Units} units of ${request.BloodType}.`,
                    "booking_request",
                    request.RequestId
                );

                if (notification) {
                    io.to(orgUserId).emit('newNotification', notification);
                }
            }
        }

        return res.status(201).json({
            message: 'Booking request sent successfully. Waiting for approval.',
            request
        });
    } catch (error: any) {
        console.error('Error in createBooking:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const approveBooking = async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { organization: true },
        });

        if (!user || user.Role.toLowerCase() !== 'organization' || !user.organization) {
            return res.status(403).json({ message: 'Only organizations can approve requests' });
        }

        const organizationId = user.organization.OrganizationId;

        if (!requestId) {
            return res.status(400).json({ message: 'Request ID is required' });
        }

        const request = await prisma.bloodRequest.findUnique({
            where: { RequestId: parseInt(requestId) },
            include: { gainer: { select: { UserId: true } } }
        });

        if (!request || request.OrganizationId !== organizationId) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.Status !== 'Pending') {
            return res.status(400).json({ message: `Request is already ${request.Status}` });
        }

        // Check inventory
        const inventory = await prisma.inventory.findFirst({
            where: {
                OrganizationId: organizationId,
                BloodType: request.BloodType,
            }
        });

        if (!inventory || inventory.Units < request.Units) {
            return res.status(400).json({ message: 'Insufficient inventory units' });
        }

        // Transaction: Deduct inventory and approve request
        const result = await prisma.$transaction(async (tx) => {
            const updatedInventory = await tx.inventory.update({
                where: { InventoryId: inventory.InventoryId },
                data: { Units: { decrement: request.Units } }
            });

            await logInventoryChange(
                organizationId,
                request.BloodType,
                -request.Units,
                'Booking',
                inventory.Units,
                inventory.Units - request.Units,
                request.RequestId
            );

            const updatedRequest = await tx.bloodRequest.update({
                where: { RequestId: parseInt(requestId as string) },
                data: { Status: 'Approved' }
            });

            return { updatedRequest, updatedInventory };
        });

        // Notify gainer via socket
        const io = req.app.get('socketio');
        const gainerUserId = request.gainer?.UserId;
        if (io && gainerUserId) {
            io.to(gainerUserId).emit('bookingApproved', {
                requestId: result.updatedRequest.RequestId,
                bloodType: result.updatedRequest.BloodType,
                units: result.updatedRequest.Units,
            });

            // Also emit inventory update for real-time dashboard updates
            io.emit('inventoryUpdated', {
                organizationId: organizationId,
                bloodType: request.BloodType,
                newUnits: result.updatedInventory.Units,
            });

            // Save persistent notification
            const orgName = user.organization.OrganizationName;
            const notification = await createNotification(
                gainerUserId,
                "Request Approved!",
                `Your request for ${result.updatedRequest.BloodType} at ${orgName} has been approved.`,
                "booking_status",
                result.updatedRequest.RequestId
            );

            if (notification) {
                io.to(gainerUserId).emit('newNotification', notification);
            }
        }

        return res.status(200).json({
            message: 'Booking approved successfully',
            request: result.updatedRequest,
            inventory: result.updatedInventory
        });
    } catch (error: any) {
        console.error('Error in approveBooking:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const rejectBooking = async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { organization: true },
        });

        if (!user || user.Role.toLowerCase() !== 'organization' || !user.organization) {
            return res.status(403).json({ message: 'Only organizations can reject requests' });
        }

        const organizationId = user.organization.OrganizationId;

        if (!requestId) {
            return res.status(400).json({ message: 'Request ID is required' });
        }

        const request = await prisma.bloodRequest.findUnique({
            where: { RequestId: parseInt(requestId) },
            include: { gainer: { select: { UserId: true } } }
        });

        if (!request || request.OrganizationId !== organizationId) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const updatedRequest = await prisma.bloodRequest.update({
            where: { RequestId: parseInt(requestId as string) },
            data: { Status: 'Rejected' }
        });

        // Notify gainer via socket
        const io = req.app.get('socketio');
        const gainerUserId = request.gainer?.UserId;
        if (io && gainerUserId) {
            io.to(gainerUserId).emit('bookingRejected', {
                requestId: updatedRequest.RequestId,
                bloodType: updatedRequest.BloodType,
            });

            // Save persistent notification
            const orgName = user.organization.OrganizationName;
            const notification = await createNotification(
                gainerUserId,
                "Request Rejected",
                `Your request for ${updatedRequest.BloodType} at ${orgName} was rejected.`,
                "booking_status",
                updatedRequest.RequestId
            );

            if (notification) {
                io.to(gainerUserId).emit('newNotification', notification);
            }
        }

        return res.status(200).json({
            message: 'Booking rejected successfully',
            request: updatedRequest
        });
    } catch (error: any) {
        console.error('Error in rejectBooking:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getOrganizationBookings = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { organization: true },
        });

        if (!user || user.Role.toLowerCase() !== 'organization' || !user.organization) {
            return res.status(403).json({ message: 'Only organizations can view these bookings' });
        }

        const organizationId = user.organization.OrganizationId;

        const bookings = await prisma.bloodRequest.findMany({
            where: { OrganizationId: organizationId },
            include: {
                gainer: {
                    include: {
                        user: {
                            select: {
                                FullName: true,
                                Email: true,
                                Phone: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                RequestDate: 'desc'
            }
        });

        return res.status(200).json({
            message: 'Bookings fetched successfully',
            bookings
        });
    } catch (error: any) {
        console.error('Error in getOrganizationBookings:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
