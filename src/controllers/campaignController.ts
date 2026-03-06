import type { Request, Response } from "express";
import multer from "multer";
import prisma from "../models/index.js";
import catchAsync from "../utils/catchAsync.js";
import { createNotification } from "./notificationController.js";

// Multer Storage Configuration
const storage = multer.memoryStorage();

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const createCampaign = catchAsync(async (req: Request, res: Response) => {
    const { title, description, location, startDate, endDate } = req.body;
    // @ts-ignore
    const userId = req.user?.userId;

    if (!userId) {
        throw new Error("User not authenticated");
    }

    const organization = await prisma.organization.findFirst({
        where: { UserId: userId as string }
    });

    if (!organization) {
        res.status(403).json({ message: "Only organizations can create campaigns" });
        return;
    }

    const posterFile = req.file;

    const campaignData: any = {
        Title: title,
        Description: description,
        Location: location,
        StartDate: new Date(startDate),
        EndDate: new Date(endDate),
        OrganizationId: organization.OrganizationId
    };

    if (posterFile) {
        campaignData.PosterData = posterFile.buffer;
        campaignData.PosterType = posterFile.mimetype;
    }

    const campaign = await prisma.campaign.create({
        data: campaignData
    });

    const io = req.app.get('socketio');
    if (io) {
        io.emit("newCampaign", {
            type: "campaign",
            message: `New Campaign: ${title} by ${organization.OrganizationName}`,
            campaignId: campaign.CampaignId,
            posterUrl: campaign.PosterData ? `data:${campaign.PosterType};base64,${Buffer.from(campaign.PosterData).toString('base64')}` : null
        });
    }

    res.status(201).json({
        message: "Campaign created successfully",
        campaign
    });
});

export const getMyCampaigns = catchAsync(async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.user?.userId;

    const organization = await prisma.organization.findFirst({
        where: { UserId: userId as string }
    });

    if (!organization) {
        res.status(404).json({ message: "Organization not found" });
        return;
    }

    const campaigns = await prisma.campaign.findMany({
        where: { OrganizationId: organization.OrganizationId },
        include: { organization: true },
        orderBy: { StartDate: 'desc' }
    });

    const mappedCampaigns = campaigns.map(c => ({
        id: c.CampaignId.toString(),
        title: c.Title,
        description: c.Description,
        location: c.Location,
        startDate: c.StartDate,
        endDate: c.EndDate,
        posterUrl: c.PosterData ? `data:${c.PosterType};base64,${Buffer.from(c.PosterData).toString('base64')}` : null,
        status: new Date() < new Date(c.EndDate) ? 'active' : 'ended',
        organizationName: c.organization.OrganizationName
    }));

    res.status(200).json({ campaigns: mappedCampaigns });
});

export const getAllCampaigns = catchAsync(async (req: Request, res: Response) => {
    const campaigns = await prisma.campaign.findMany({
        include: {
            organization: {
                include: {
                    user: true
                }
            }
        },
        orderBy: {
            StartDate: 'asc'
        }
    });

    const formattedCampaigns = campaigns.map(camp => ({
        id: camp.CampaignId.toString(),
        title: camp.Title,
        description: camp.Description,
        location: camp.Location,
        startDate: camp.StartDate.toISOString(),
        endDate: camp.EndDate.toISOString(),
        posterUrl: camp.PosterData ? `data:${camp.PosterType};base64,${Buffer.from(camp.PosterData).toString('base64')}` : null,
        status: new Date() < new Date(camp.EndDate) ? 'active' : 'ended',
        organizationName: camp.organization.OrganizationName,
        organizationPhone: camp.organization.Contact || camp.organization.user.Phone,
        organizationEmail: camp.organization.user.Email
    }));

    res.status(200).json({ campaigns: formattedCampaigns });
});

export const updateCampaign = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, location, startDate, endDate } = req.body;
    // @ts-ignore
    const userId = req.user?.userId;

    if (!userId) {
        throw new Error("User not authenticated");
    }
    const organization = await prisma.organization.findFirst({
        where: { UserId: userId as string }
    });

    if (!organization) {
        res.status(403).json({ message: "Only organizations can update campaigns" });
        return;
    }

    const posterFile = req.file;
    const updateData: any = {
        Title: title,
        Description: description,
        Location: location,
        StartDate: new Date(startDate),
        EndDate: new Date(endDate)
    };

    if (posterFile) {
        updateData.PosterData = posterFile.buffer;
        updateData.PosterType = posterFile.mimetype;
    }

    const updatedCampaign = await prisma.campaign.update({
        where: { CampaignId: Number(id) },
        data: updateData
    });

    res.status(200).json({
        message: "Campaign updated successfully",
        campaign: updatedCampaign
    });
});

export const deleteCampaign = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.campaign.delete({
        where: { CampaignId: Number(id) }
    });

    res.status(200).json({ message: "Campaign deleted successfully" });
});

export const recordAttendance = catchAsync(async (req: Request, res: Response) => {
    const { campaignId, userId, bloodType, units } = req.body;
    // @ts-ignore
    const authUserId = req.user?.userId;

    if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const campaign = await prisma.campaign.findUnique({
        where: { CampaignId: Number(campaignId) },
        include: { organization: true }
    });

    if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
    }

    // Check if user already attended
    // @ts-ignore
    const existingAttendance = await prisma.campAttendance.findFirst({
        where: {
            CampaignId: Number(campaignId),
            UserId: userId || authUserId
        }
    });

    if (existingAttendance) {
        return res.status(400).json({ message: "You have already attended this camp!" });
    }

    // @ts-ignore
    const attendance = await prisma.campAttendance.create({
        data: {
            CampaignId: Number(campaignId),
            UserId: userId || authUserId,
            BloodType: bloodType,
            Units: Number(units) || 1
        }
    });

    const organizationId = campaign.OrganizationId;
    const existingInventory = await prisma.inventory.findFirst({
        where: {
            OrganizationId: organizationId,
            BloodType: bloodType
        }
    });

    if (existingInventory) {
        await prisma.inventory.update({
            where: { InventoryId: existingInventory.InventoryId },
            data: { Units: existingInventory.Units + (Number(units) || 1) }
        });
    } else {
        await prisma.inventory.create({
            data: {
                OrganizationId: organizationId,
                BloodType: bloodType,
                Units: Number(units) || 1
            }
        });
    }

    const donor = await prisma.user.findUnique({
        where: { UserId: userId || authUserId },
        select: { FullName: true }
    });

    const io = req.app.get('socketio');
    if (io) {
        await createNotification(
            userId || authUserId,
            "Thank You for Your Contribution!",
            `Your donation at ${campaign.Title} is highly appreciated. You've helped save lives!`,
            "donation_thankyou",
            attendance.AttendanceId,
            io
        );
    }

    res.status(201).json({
        message: "Attendance recorded and inventory updated successfully",
        attendance
    });
});

export const getAttendees = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    // @ts-ignore
    const attendances = await prisma.campAttendance.findMany({
        where: { CampaignId: Number(id) },
        include: {
            user: {
                select: {
                    FullName: true,
                    Email: true,
                    Phone: true
                }
            }
        },
        orderBy: { CreatedAt: 'desc' }
    });

    const attendees = attendances.map((a: any) => ({
        id: a.AttendanceId,
        fullName: a.user.FullName,
        email: a.user.Email,
        phone: a.user.Phone,
        bloodType: a.BloodType,
        units: a.Units,
        attendedAt: a.CreatedAt
    }));

    res.status(200).json({ attendees });
});
