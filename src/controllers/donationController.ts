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

export const createDonationOffer = async (req: Request, res: Response) => {
    const { organizationId, bloodType, units } = req.body;
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    console.log("createDonationOffer called with:", { organizationId, bloodType, units, authUserId, authError });

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true },
        });

        if (!user || user.Role.toLowerCase() !== 'donor' || !user.donor) {
            return res.status(403).json({ message: 'Only donors can create donation offers' });
        }

        const donorId = user.donor.DonorId;

        // Create the donation offer as Pending
        const offer = await prisma.donationOffer.create({
            data: {
                DonorId: donorId,
                OrganizationId: Number(organizationId),
                Status: 'pending',

            },
        });


        // Notify organization via socket
        const io = req.app.get('socketio');
        if (io) {
            const org = await prisma.organization.findUnique({
                where: { OrganizationId: Number(organizationId) },
                select: { UserId: true }
            });

            const orgUserId = org?.UserId;
            if (orgUserId) {
                console.log(`Sending newDonationOffer to org user: ${orgUserId}`);
                io.to(orgUserId).emit('newDonationOffer', {
                    offerId: offer.OfferId,
                    donorName: user.FullName,
                    bloodType: user.donor.BloodType,
                    timestamp: offer.CreatedAt,
                });

                // Save persistent notification and emit via io
                await createNotification(
                    orgUserId,
                    "New Donation Offer",
                    `${user.FullName} offered to donate ${user.donor.BloodType} blood.`,
                    "donation_request",
                    offer.OfferId,
                    io
                );
            }
        }

        return res.status(201).json({
            message: 'Donation offer sent successfully. Waiting for approval.',
            offer
        });
    } catch (error: any) {
        console.error('Error in createDonationOffer:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const updateDonationStatus = async (req: Request, res: Response) => {
    const { offerId } = req.params;
    const { status, donationDate } = req.body; // 'accepted' or 'rejected'
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
            return res.status(403).json({ message: 'Only organizations can update donation status' });
        }

        const organizationId = user.organization.OrganizationId;

        const offer = await prisma.donationOffer.findUnique({
            where: { OfferId: parseInt(offerId as string) },
            include: { donor: { include: { user: { select: { UserId: true } } } } }
        });

        if (!offer || offer.OrganizationId !== organizationId) {
            return res.status(404).json({ message: 'Donation offer not found' });
        }

        if (offer.Status !== 'pending') {
            return res.status(400).json({ message: `Offer is already ${offer.Status}` });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedOffer = await tx.donationOffer.update({
                where: { OfferId: parseInt(offerId as string) },
                data: {
                    Status: status,
                    DonationDate: status === 'accepted' ? new Date(donationDate || new Date()) : null
                }
            });

            if (status === 'accepted') {
                // Find or create inventory for this blood type
                const inventory = await tx.inventory.findFirst({
                    where: {
                        OrganizationId: organizationId,
                        BloodType: offer.donor.BloodType
                    }
                });

                if (inventory) {
                    await tx.inventory.update({
                        where: { InventoryId: inventory.InventoryId },
                        data: { Units: { increment: 1 } } // Assuming 1 unit per donation
                    });
                } else {
                    await tx.inventory.create({
                        data: {
                            OrganizationId: organizationId,
                            BloodType: offer.donor.BloodType,
                            Units: 1
                        }
                    });
                }
            }

            return updatedOffer;
        });

        // Notify donor via socket
        const io = req.app.get('socketio');
        const donorUserId = offer.donor.user.UserId;
        if (io && donorUserId) {
            io.to(donorUserId).emit('donationStatusUpdated', {
                offerId: result.OfferId,
                status: result.Status,
                donationDate: result.DonationDate
            });

            // Save persistent notification & emit
            const orgName = user.organization.OrganizationName;
            await createNotification(
                donorUserId,
                `Donation ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                `${orgName} has ${status} your donation offer.${status === 'accepted' ? ' Check your schedule for details.' : ''}`,
                "donation_status",
                result.OfferId,
                io
            );
        }

        return res.status(200).json({
            message: `Donation offer ${status} successfully`,
            offer: result
        });
    } catch (error: any) {
        console.error('Error in updateDonationStatus:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getDonationOffers = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

    if (authError || !authUserId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true, organization: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let offers;
        if (user.Role.toLowerCase() === 'donor' && user.donor) {
            offers = await prisma.donationOffer.findMany({
                where: { DonorId: user.donor.DonorId },
                include: { organization: true },
                orderBy: { CreatedAt: 'desc' }
            });
        } else if (user.Role.toLowerCase() === 'organization' && user.organization) {
            offers = await prisma.donationOffer.findMany({
                where: { OrganizationId: user.organization.OrganizationId },
                include: { donor: { include: { user: true } } },
                orderBy: { CreatedAt: 'desc' }
            });
        } else {
            return res.status(403).json({ message: 'Invalid role for viewing donation offers' });
        }

        return res.status(200).json({ offers });
    } catch (error: any) {
        console.error('Error in getDonationOffers:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getDonorSchedule = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true },
        });

        if (!user || user.Role.toLowerCase() !== 'donor' || !user.donor) {
            return res.status(403).json({ message: 'Donor profile not found' });
        }

        const offers = await prisma.donationOffer.findMany({
            where: {
                DonorId: user.donor.DonorId,
                Status: { in: ['accepted', 'rejected'] }
            },
            include: { organization: true, donor: true },
            orderBy: { DonationDate: 'desc' }
        });

        return res.status(200).json({ offers });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getOrgRequests = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { organization: true },
        });

        if (!user || user.Role.toLowerCase() !== 'organization' || !user.organization) {
            return res.status(403).json({ message: 'Organization profile not found' });
        }

        const offers = await prisma.donationOffer.findMany({
            where: {
                OrganizationId: user.organization.OrganizationId,
                Status: 'pending'
            },
            include: { donor: { include: { user: true } } },
            orderBy: { CreatedAt: 'desc' }
        });

        return res.status(200).json({ offers });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getOrgConfirmed = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { organization: true },
        });

        if (!user || user.Role.toLowerCase() !== 'organization' || !user.organization) {
            return res.status(403).json({ message: 'Organization profile not found' });
        }

        const offers = await prisma.donationOffer.findMany({
            where: {
                OrganizationId: user.organization.OrganizationId,
                Status: 'accepted'
            },
            include: { donor: { include: { user: true } } },
            orderBy: { DonationDate: 'desc' }
        });

        return res.status(200).json({ offers });
    } catch (error: any) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getDonorHistory = async (req: Request, res: Response) => {
    const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);
    if (authError || !authUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({
            where: { UserId: authUserId },
            include: { donor: true },
        });

        if (!user || user.Role.toLowerCase() !== 'donor' || !user.donor) {
            return res.status(403).json({ message: 'Donor profile not found' });
        }

        const donorId = user.donor.DonorId;

        // Fetch regular donation offers to organizations
        const offers = await prisma.donationOffer.findMany({
            where: { DonorId: donorId },
            include: { organization: true },
            orderBy: { CreatedAt: 'desc' }
        });

        // Fetch responses to emergency blood requests
        const responses = await prisma.donorResponse.findMany({
            where: { DonorId: donorId },
            include: {
                request: {
                    include: {
                        gainer: {
                            include: { user: { select: { FullName: true } } }
                        }
                    }
                }
            },
            orderBy: { CreatedAt: 'desc' }
        });

        // Combine and format history
        const history = [
            ...offers.map(o => ({
                id: o.OfferId,
                type: 'Donation Offer',
                name: o.organization.OrganizationName,
                bloodType: user.donor?.BloodType,
                units: 1, // Regular donations are typically 1 unit
                status: o.Status,
                date: o.CreatedAt,
                scheduledDate: o.DonationDate
            })),
            ...responses.map(r => ({
                id: r.ResponseId,
                type: 'Emergency Response',
                name: r.request.gainer?.user?.FullName || 'Unknown Gainer',
                bloodType: r.request.BloodType,
                units: r.request.Units,
                status: r.Status,
                date: r.CreatedAt
            }))
        ];

        // Sort by date descending
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return res.status(200).json({ history });
    } catch (error: any) {
        console.error('Error in getDonorHistory:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
