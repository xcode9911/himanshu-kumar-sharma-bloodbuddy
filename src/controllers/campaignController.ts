import type { Request, Response } from "express";
import multer from "multer";
import prisma from "../models/index.js";
import catchAsync from "../utils/catchAsync.js";

// Multer Storage Configuration
// Multer Storage Configuration
const storage = multer.memoryStorage();

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const createCampaign = catchAsync(async (req: Request, res: Response) => {
    const { title, description, location, startDate, endDate } = req.body;
    // @ts-ignore
    const userId = req.user?.userId; // Assuming auth middleware adds user

    if (!userId) {
        throw new Error("User not authenticated");
    }

    // Find Organization ID for the user
    const organization = await prisma.organization.findUnique({
        where: { UserId: userId }
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

    // Notify Users (Donors & Gainers)
    const io = req.app.get('socketio');
    if (io) {
        io.emit("newCampaign", {
            type: "campaign",
            message: `New Campaign: ${title} by ${organization.OrganizationName}`,
            campaignId: campaign.CampaignId,
            posterUrl: campaign.PosterData ? `data:${campaign.PosterType};base64,${Buffer.from(campaign.PosterData).toString('base64')}` : null
        });
    }

    // Create Notifications in DB for all users (This might be heavy for all users, maybe target generic topic users?)
    // For now, let's just create a generic notification for the organization to confirm
    // Or real implementation would loop through relevant donors. 
    // Skipping bulk DB insert for now to avoid performance hit on large userbase without a queue.

    res.status(201).json({
        message: "Campaign created successfully",
        campaign
    });
});

export const getMyCampaigns = catchAsync(async (req: Request, res: Response) => {
    // @ts-ignore
    const userId = req.user?.userId;

    if (!userId) {
        const campaigns = await prisma.campaign.findMany({
            include: { organization: true },
            orderBy: { StartDate: 'asc' }
        });
        res.status(200).json({ campaigns });
        return;
    }

    const organization = await prisma.organization.findUnique({
        where: { UserId: userId }
    });

    let campaigns;
    if (organization) {
        // Return organization's campaigns
        campaigns = await prisma.campaign.findMany({
            where: { OrganizationId: organization.OrganizationId },
            orderBy: { StartDate: 'desc' }
        });
    } else {
        // Return all active campaigns for donors/gainers
        campaigns = await prisma.campaign.findMany({
            include: { organization: true },
            orderBy: { StartDate: 'asc' }
        });
    }

    // Map to frontend friendly format if needed, but Prisma model should be fine
    // Frontend expects lowercase fields? Check frontend interface: id, title...
    // Backend returns Title, Description...
    // We should map them.

    const mappedCampaigns = campaigns.map(c => ({
        id: c.CampaignId.toString(),
        title: c.Title,
        description: c.Description,
        location: c.Location,
        startDate: c.StartDate,
        endDate: c.EndDate,
        posterUrl: c.PosterData ? `data:${c.PosterType};base64,${Buffer.from(c.PosterData).toString('base64')}` : null,
        status: new Date() < new Date(c.EndDate) ? 'active' : 'ended',
        organizationName: (c as any).organization?.OrganizationName
    }));

    res.status(200).json({ campaigns: mappedCampaigns });
});

export const updateCampaign = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, location, startDate, endDate } = req.body;
    // @ts-ignore
    const userId = req.user?.userId;

    if (!userId) {
        throw new Error("User not authenticated");
    }
    const organization = await prisma.organization.findUnique({
        where: { UserId: userId }
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
