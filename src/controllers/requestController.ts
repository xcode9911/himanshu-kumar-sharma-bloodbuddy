import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';
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

export const createBloodRequest = async (req: Request, res: Response) => {
    const { organizationId, bloodType, units } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    // Check authentication
    if (authError === 'missing') {
        return res.status(401).json({ message: 'Authorization bearer token is required' });
    }

    if (authError === 'invalid') {
        return res.status(401).json({ message: 'Invalid or expired authorization token' });
    }

    if (!authUserId) {
        return res.status(401).json({ message: 'User ID not found in token' });
    }

    // Validate input
    if (!organizationId || typeof organizationId !== 'number') {
        return res.status(400).json({ message: 'Valid Organization ID is required' });
    }

    if (!bloodType || typeof bloodType !== 'string') {
        return res.status(400).json({ message: 'Blood type is required' });
    }

    if (!units || typeof units !== 'number' || units <= 0) {
        return res.status(400).json({ message: 'Valid units (positive number) are required' });
    }

    try {
        // 1. Fetch user and verify role is Gainer
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { gainer: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.Role.toLowerCase() !== 'gainer' || !user.gainer) {
            return res.status(403).json({ message: 'Only gainers can book blood units' });
        }

        const gainerId = user.gainer.GainerId;

        // 2. Check Organization and Inventory
        const inventory = await prisma.inventory.findFirst({
            where: {
                OrganizationId: organizationId,
                BloodType: bloodType,
            },
        });

        if (!inventory) {
            return res.status(404).json({ message: 'Blood type not found in this organization inventory' });
        }

        if (inventory.Units < units) {
            return res.status(400).json({
                message: `Insufficient blood units. Available: ${inventory.Units}, Requested: ${units}`
            });
        }

        // 3. Perform Transaction: Decrement Inventory & Create Request
        const result = await prisma.$transaction(async (tx) => {
            // Decrement inventory
            const updatedInventory = await tx.inventory.update({
                where: { InventoryId: inventory.InventoryId },
                data: {
                    Units: {
                        decrement: units,
                    },
                },
            });

            // Create Blood Request
            const bloodRequest = await tx.bloodRequest.create({
                data: {
                    GainerId: gainerId,
                    OrganizationId: organizationId,
                    BloodType: bloodType,
                    Units: units,
                    Status: 'Approved', // Auto-approve/Reserved as per booking requirement
                },
            });

            return { updatedInventory, bloodRequest };
        });

        // 4. Emit Socket.io Event & Create Notification
        const io = req.app.get('socketio');
        if (io) {
            io.emit('inventoryUpdated', {
                organizationId: organizationId,
                bloodType: bloodType,
                newUnits: result.updatedInventory.Units,
            });

            // Find organization user to notify
            const org = await prisma.organization.findUnique({
                where: { OrganizationId: organizationId },
                select: { UserId: true, OrganizationName: true }
            });

            if (org) {
                await createNotification(
                    org.UserId,
                    "New Blood Booking",
                    `${user.FullName} booked ${units} units of ${bloodType}.`,
                    "booking_request",
                    result.bloodRequest.RequestId,
                    io
                );
            }
        }

        return res.status(201).json({
            message: 'Blood units booked successfully',
            request: result.bloodRequest,
            remainingUnits: result.updatedInventory.Units,
        });

    } catch (error: any) {
        console.error('Error creating blood request:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Cancel Blood Request
export const cancelBloodRequest = async (req: Request, res: Response) => {
    const { requestId } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    // Check authentication
    if (authError === 'missing') {
        return res.status(401).json({ message: 'Authorization bearer token is required' });
    }

    if (authError === 'invalid') {
        return res.status(401).json({ message: 'Invalid or expired authorization token' });
    }

    if (!authUserId) {
        return res.status(401).json({ message: 'User ID not found in token' });
    }

    if (!requestId || typeof requestId !== 'number') {
        return res.status(400).json({ message: 'Valid Request ID is required' });
    }

    try {
        // 1. Fetch user to verify identity (Gainer or Organization - simplified to Gainer for now as per request)
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { gainer: true, organization: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Fetch the blood request
        const bloodRequest = await prisma.bloodRequest.findUnique({
            where: { RequestId: requestId },
        });

        if (!bloodRequest) {
            return res.status(404).json({ message: 'Blood request not found' });
        }

        // 3. Authorization Check
        // Allow Gainer who created it OR Organization receiving it
        let isAuthorized = false;
        if (user.Role.toLowerCase() === 'gainer' && user.gainer && bloodRequest.GainerId === user.gainer.GainerId) {
            isAuthorized = true;
        } else if (user.Role.toLowerCase() === 'organization' && user.organization && bloodRequest.OrganizationId === user.organization.OrganizationId) {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'You are not authorized to cancel this request' });
        }

        // 4. Validate Status
        if (bloodRequest.Status.toLowerCase() === 'cancelled') {
            return res.status(400).json({ message: 'Request is already cancelled' });
        }
        // Assuming we can cancel 'Approved' (which means Reserved in this context) or 'Pending'

        // 5. Transaction: Update Status & Restore Inventory
        const result = await prisma.$transaction(async (tx) => {
            // Update request status
            const updatedRequest = await tx.bloodRequest.update({
                where: { RequestId: requestId },
                data: { Status: 'Cancelled' },
            });

            // Restore inventory
            // Use findFirst to get InventoryId for that Org and BloodType
            const inventory = await tx.inventory.findFirst({
                where: {
                    OrganizationId: bloodRequest.OrganizationId,
                    BloodType: bloodRequest.BloodType
                }
            });

            let updatedInventory = null;
            if (inventory) {
                updatedInventory = await tx.inventory.update({
                    where: { InventoryId: inventory.InventoryId },
                    data: {
                        Units: {
                            increment: bloodRequest.Units
                        }
                    }
                });
            } else {
                // Edge case: Inventory record was deleted? Re-create it?
                // For now, if no inventory record exists, we might need to create one or log error.
                // Assuming inventory record persists normally.
                updatedInventory = await tx.inventory.create({
                    data: {
                        OrganizationId: bloodRequest.OrganizationId,
                        BloodType: bloodRequest.BloodType,
                        Units: bloodRequest.Units
                    }
                });
            }

            return { updatedRequest, updatedInventory };
        });

        // 6. Emit Socket Event
        const io = req.app.get('socketio');
        if (io && result.updatedInventory) {
            io.emit('inventoryUpdated', {
                organizationId: bloodRequest.OrganizationId,
                bloodType: bloodRequest.BloodType,
                newUnits: result.updatedInventory.Units,
            });
        }

        return res.status(200).json({
            message: 'Blood request cancelled successfully',
            request: result.updatedRequest,
            restoredUnits: result.updatedInventory?.Units
        });

    } catch (error: any) {
        console.error('Error cancelling blood request:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get Bookings by Specific User ID
export const getBookingsByUserId = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    // Check authentication
    if (authError === 'missing') {
        return res.status(401).json({ message: 'Authorization bearer token is required' });
    }

    if (authError === 'invalid') {
        return res.status(401).json({ message: 'Invalid or expired authorization token' });
    }

    if (!authUserId) {
        return res.status(401).json({ message: 'User ID not found in token' });
    }

    if (!userId) {
        return res.status(400).json({ message: 'User ID parameter is required' });
    }

    try {
        // Fetch the user by the provided userId
        const user = await prisma.user.findUnique({
            where: { UserId: userId },
            include: { gainer: true, organization: true, donor: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Security Check: Only allow users to see their own bookings
        if (user.UserId !== authUserId) {
            return res.status(403).json({ message: 'You are not authorized to view these bookings' });
        }

        let requests = [];

        if (user.Role.toLowerCase() === 'gainer' && user.gainer) {
            requests = await prisma.bloodRequest.findMany({
                where: { GainerId: user.gainer.GainerId },
                include: {
                    organization: {
                        select: {
                            OrganizationId: true,
                            OrganizationName: true,
                            Location: true,
                            Contact: true,
                        }
                    },
                    donorResponses: {
                        where: { Status: 'Accepted' },
                        include: {
                            donor: {
                                include: {
                                    user: {
                                        select: {
                                            FullName: true,
                                            Phone: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { RequestDate: 'desc' },
            });
        } else if (user.Role.toLowerCase() === 'donor' && user.donor) {
            requests = await prisma.bloodRequest.findMany({
                where: {
                    OR: [
                        {
                            donorResponses: {
                                some: {
                                    DonorId: user.donor.DonorId,
                                    Status: 'Accepted'
                                }
                            }
                        },
                        {
                            Status: 'Emergency',
                            BloodType: user.donor.BloodType
                        }
                    ]
                },
                include: {
                    gainer: {
                        include: {
                            user: {
                                select: {
                                    FullName: true,
                                    Phone: true
                                }
                            }
                        }
                    },
                    organization: {
                        select: {
                            OrganizationId: true,
                            OrganizationName: true,
                        }
                    }
                },
                orderBy: { RequestDate: 'desc' },
            });
        } else if (user.Role.toLowerCase() === 'organization' && user.organization) {
            requests = await prisma.bloodRequest.findMany({
                where: { OrganizationId: user.organization.OrganizationId },
                include: {
                    gainer: {
                        include: {
                            user: {
                                select: {
                                    FullName: true,
                                    Email: true,
                                    Phone: true,
                                }
                            }
                        }
                    }
                },
                orderBy: { RequestDate: 'desc' },
            });
        } else {
            return res.status(400).json({ message: 'Invalid role for fetching bookings' });
        }

        return res.status(200).json({
            message: 'Bookings retrieved successfully',
            count: requests.length,
            requests: requests,
        });

    } catch (error: any) {
        console.error('Error fetching bookings by user ID:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
