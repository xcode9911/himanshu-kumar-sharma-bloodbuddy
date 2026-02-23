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

/**
 * Notifies all available donors about an emergency request
 */
async function notifyDonors(req: Request, requestId: number, bloodType: string, gainerName: string, units: number) 
{
    const io = req.app.get('socketio');

    // Find all available donors with matching blood type
    const donors = await prisma.donor.findMany({
        where: {
            IsAvailable: true,
            BloodType: bloodType
        },
        include: {
            user: {
                select: {
                    UserId: true,
                    FullName: true
                }
            }
        }
    });

    for (const donor of donors) {
        const donorUserId = donor.user.UserId;

        // Send persistent notification
        const notification = await createNotification(
            donorUserId,
            "EMERGENCY BLOOD REQUEST!",
            `${gainerName} urgently needs ${units} units of ${bloodType} blood.`,
            "emergency_request",
            requestId
        );

        if (io) {
            // Emit to donor's room
            io.to(donorUserId).emit('newEmergencyRequest', {
                requestId,
                gainerName,
                bloodType,
                units,
                notification
            });
        }
    }
}

const VALID_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const createEmergencyRequest = async (req: Request, res: Response) => {
    const { bloodType, units } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate Input
    if (!bloodType || !VALID_BLOOD_TYPES.includes(bloodType)) {
        return res.status(400).json({
            message: `Invalid blood type. Must be one of: ${VALID_BLOOD_TYPES.join(', ')}`
        });
    }

    if (!units || typeof units !== 'number' || units <= 0) {
        return res.status(400).json({ message: 'Valid units (positive number) are required' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { gainer: true },
        });

        if (!user || user.Role.toLowerCase() !== 'gainer' || !user.gainer) {
            return res.status(403).json({ message: 'Only gainers can create emergency requests' });
        }

        const gainerId = user.gainer.GainerId;

        // Use a placeholder organization if none specified, as BloodRequest requires it
        const firstOrg = await prisma.organization.findFirst();
        if (!firstOrg) {
            return res.status(500).json({ message: 'No organizations found to associate with request' });
        }

        const request = await prisma.bloodRequest.create({
            data: {
                GainerId: gainerId,
                OrganizationId: firstOrg.OrganizationId,
                BloodType: bloodType,
                Units: units,
                Status: 'Emergency',
            }
        });

        // NOTIFY ONLY DONORS WITH THE SAME BLOOD GROUP
        await notifyDonors(req, request.RequestId, bloodType, user.FullName, units);

        return res.status(201).json({
            message: 'Emergency request created and donors notified',
            request
        });
    } catch (error: any) {
        console.error('Error in createEmergencyRequest:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const acceptEmergencyRequest = async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { latitude, longitude } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true },
        });

        if (!user || user.Role.toLowerCase() !== 'donor' || !user.donor) {
            return res.status(403).json({ message: 'Only donors can accept emergency requests' });
        }

        const donorId = user.donor.DonorId;

        const request = await prisma.bloodRequest.findUnique({
            where: { RequestId: parseInt(requestId as string) },
            include: { gainer: { include: { user: true } } }
        });

        if (!request || request.Status !== 'Emergency') {
            return res.status(404).json({ message: 'Emergency request not found or already handled' });
        }

        // Update request status and record donor response
        const [updatedRequest, donorResponse] = await prisma.$transaction(async (tx) => {
            const reqUpdate = await tx.bloodRequest.update({
                where: { RequestId: request.RequestId },
                data: { Status: 'Accepted' }
            });

            const response = await tx.donorResponse.create({
                data: {
                    RequestId: request.RequestId,
                    DonorId: donorId,
                    Status: 'Accepted'
                }
            });

            // Create Location record if coordinates provided
            if (latitude && longitude) {
                await tx.location.create({
                    data: {
                        ResponseId: response.ResponseId,
                        DonorId: donorId,
                        GainerId: request.GainerId,
                        Latitude: parseFloat(latitude),
                        Longitude: parseFloat(longitude),
                        IsActive: true
                    }
                });
            }

            return [reqUpdate, response];
        });

        // Notify gainer
        const io = req.app.get('socketio');
        const gainerUserId = request.gainer?.UserId;
        if (io && gainerUserId) {
            io.to(gainerUserId).emit('emergencyAccepted', {
                requestId: request.RequestId,
                donorName: user.FullName,
                donorPhone: user.Phone,
                location: latitude && longitude ? { latitude, longitude } : null
            });

            await createNotification(
                gainerUserId,
                "Emergency Request Accepted",
                `${user.FullName} has accepted your emergency request!`,
                "emergency_accepted",
                request.RequestId
            );
        }

        return res.status(200).json({ message: 'Emergency request accepted successfully' });
    } catch (error: any) {
        console.error('Error in acceptEmergencyRequest:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const cancelEmergencyRequest = async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true },
        });

        if (!user || user.Role.toLowerCase() !== 'donor' || !user.donor) {
            return res.status(403).json({ message: 'Only donors can cancel their acceptance' });
        }

        const donorId = user.donor.DonorId;

        const request = await prisma.bloodRequest.findUnique({
            where: { RequestId: parseInt(requestId as string) },
            include: { gainer: { include: { user: true } } }
        });

        if (!request || request.Status !== 'Accepted') {
            return res.status(400).json({ message: 'Request is not in accepted state' });
        }

        // Update response and set request back to Emergency
        await prisma.$transaction(async (tx) => {
            await tx.bloodRequest.update({
                where: { RequestId: request.RequestId },
                data: { Status: 'Emergency' }
            });

            const responses = await tx.donorResponse.findMany({
                where: {
                    RequestId: request.RequestId,
                    DonorId: donorId,
                    Status: 'Accepted'
                }
            });

            for (const resp of responses) {
                // Deactivate location sharing
                await tx.location.updateMany({
                    where: { ResponseId: resp.ResponseId },
                    data: { IsActive: false }
                });

                await tx.donorResponse.update({
                    where: { ResponseId: resp.ResponseId },
                    data: { Status: 'Cancelled' }
                });
            }
        });

        // Re-notify other donors
        await notifyDonors(req, request.RequestId, request.BloodType, request.gainer.user.FullName, request.Units);

        // Notify gainer about cancellation
        const io = req.app.get('socketio');
        const gainerUserId = request.gainer?.UserId;
        if (io && gainerUserId) {
            await createNotification(
                gainerUserId,
                "Donor Cancelled Emergency Help",
                `${user.FullName} cancelled their help. Finding other donors...`,
                "emergency_cancelled",
                request.RequestId
            );
            io.to(gainerUserId).emit('emergencyDonorCancelled', {
                requestId: request.RequestId,
                message: 'Looking for another donor...'
            });
        }

        return res.status(200).json({ message: 'Help cancelled, request re-broadcasted' });
    } catch (error: any) {
        console.error('Error in cancelEmergencyRequest:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const stopEmergencyRequest = async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const request = await prisma.bloodRequest.findUnique({
            where: { RequestId: parseInt(requestId as string) },
            include: { gainer: true }
        });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { gainer: true }
        });

        if (!user || user.gainer?.GainerId !== request.GainerId) {
            return res.status(403).json({ message: 'Only the gainer who created this request can stop it' });
        }

        await prisma.bloodRequest.update({
            where: { RequestId: request.RequestId },
            data: { Status: 'Stopped' }
        });

        return res.status(200).json({ message: 'Emergency request stopped successfully' });
    } catch (error: any) {
        console.error('Error in stopEmergencyRequest:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
