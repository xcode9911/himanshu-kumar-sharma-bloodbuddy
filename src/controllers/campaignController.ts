import type { Request, Response } from "express";
import multer from "multer";
import prisma from "../models/index.js";
import catchAsync from "../utils/catchAsync.js";
import { logInventoryChange } from "../utils/inventoryLogger.js";
import { createNotification } from "./notificationController.js";

import fs from "fs";
import path from "path";
import { getFullImageUrl } from "../utils/imageUtils.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/campaigns";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, webp) are allowed"));
  },
});

const parseOrganizationIds = (raw: unknown): number[] => {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ];
    }
  } catch {
    return [
      ...new Set(
        raw
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  }

  return [];
};

const parsePositiveInteger = (raw: unknown): number | null => {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const hasProvidedValue = (raw: unknown): boolean =>
  !(raw === undefined || raw === null || raw === "");

const getOrganizationByUserId = async (userId: string) => {
  return prisma.organization.findFirst({
    where: { UserId: userId },
  });
};

const mapCampaign = (campaign: any) => {
  const collaborations = Array.isArray(campaign.collaborations)
    ? campaign.collaborations.map((collaboration: any) => ({
        id: String(collaboration.CollaborationId),
        organizationId: String(collaboration.organization?.OrganizationId),
        organizationName: collaboration.organization?.OrganizationName,
        status: collaboration.Status,
        invitedByOrganizationId: String(collaboration.InvitedByOrganizationId),
        message: collaboration.Message,
        responseMessage: collaboration.ResponseMessage,
      }))
    : [];

  return {
    id: String(campaign.CampaignId),
    title: campaign.Title,
    description: campaign.Description,
    location: campaign.Location,
    targetAttendees: campaign.TargetAttendees,
    targetUnits: campaign.TargetUnits,
    latitude: campaign.Latitude,
    longitude: campaign.Longitude,
    startDate: campaign.StartDate,
    endDate: campaign.EndDate,
    posterUrl: getFullImageUrl(campaign.PosterUrl),
    status: new Date() < new Date(campaign.EndDate) ? "active" : "ended",
    organizationName: campaign.organization?.OrganizationName,
    organizationLogoUrl: getFullImageUrl(
      campaign.organization?.user?.ProfileImage,
    ),
    organizationPhone:
      campaign.organization?.Contact || campaign.organization?.user?.Phone,
    organizationEmail: campaign.organization?.user?.Email,
    isCollaborativeCampaign: campaign.IsCollaborativeCampaign,
    collaborationNote: campaign.CollaborationNote,
    collaboratingOrganizations: collaborations,
  };
};

const upsertCampaignInvitations = async (
  campaignId: number,
  invitedByOrganizationId: number,
  organizationIds: number[],
  message?: string,
) => {
  const uniqueIds = [
    ...new Set(organizationIds.filter((id) => id !== invitedByOrganizationId)),
  ];

  let created = 0;
  let refreshed = 0;
  let alreadyAccepted = 0;

  for (const organizationId of uniqueIds) {
    const existing = await prisma.campaignCollaboration.findUnique({
      where: {
        CampaignId_OrganizationId: {
          CampaignId: campaignId,
          OrganizationId: organizationId,
        },
      },
    });

    if (!existing) {
      await prisma.campaignCollaboration.create({
        data: {
          CampaignId: campaignId,
          OrganizationId: organizationId,
          InvitedByOrganizationId: invitedByOrganizationId,
          Status: "pending",
          ...(typeof message === "string" ? { Message: message } : {}),
        },
      });
      created += 1;
      continue;
    }

    if (existing.Status === "accepted") {
      alreadyAccepted += 1;
      continue;
    }

    await prisma.campaignCollaboration.update({
      where: { CollaborationId: existing.CollaborationId },
      data: {
        Status: "pending",
        InvitedByOrganizationId: invitedByOrganizationId,
        RespondedAt: null,
        ResponseMessage: null,
        ...(typeof message === "string" ? { Message: message } : {}),
      },
    });
    refreshed += 1;
  }

  return { created, refreshed, alreadyAccepted };
};

const syncCampaignInvitations = async (
  campaignId: number,
  invitedByOrganizationId: number,
  organizationIds: number[],
  message?: string,
) => {
  const normalizedIds = [
    ...new Set(organizationIds.filter((id) => id !== invitedByOrganizationId)),
  ];

  const result = await upsertCampaignInvitations(
    campaignId,
    invitedByOrganizationId,
    normalizedIds,
    message,
  );

  if (normalizedIds.length === 0) {
    await prisma.campaignCollaboration.deleteMany({
      where: {
        CampaignId: campaignId,
        Status: {
          not: "accepted",
        },
      },
    });
    return result;
  }

  await prisma.campaignCollaboration.deleteMany({
    where: {
      CampaignId: campaignId,
      OrganizationId: {
        notIn: normalizedIds,
      },
      Status: {
        not: "accepted",
      },
    },
  });

  return result;
};

export const createCampaign = catchAsync(
  async (req: Request, res: Response) => {
    const {
      title,
      description,
      location,
      targetAttendees,
      targetUnits,
      latitude,
      longitude,
      startDate,
      endDate,
      collaborationNote,
    } = req.body;
    const collaboratorOrganizationIds = parseOrganizationIds(
      req.body.collaboratorOrganizationIds,
    );
    const isCollaborativeCampaignFromBody =
      String(req.body.isCollaborativeCampaign || "").toLowerCase() === "true";
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res
        .status(403)
        .json({ message: "Only organizations can create campaigns" });
      return;
    }

    const posterFile = req.file;
    const normalizedTargetAttendees = parsePositiveInteger(targetAttendees);
    const normalizedTargetUnits = parsePositiveInteger(targetUnits);

    if (
      hasProvidedValue(targetAttendees) &&
      normalizedTargetAttendees === null
    ) {
      res.status(400).json({
        message: "targetAttendees must be a positive whole number",
      });
      return;
    }

    if (hasProvidedValue(targetUnits) && normalizedTargetUnits === null) {
      res.status(400).json({
        message: "targetUnits must be a positive whole number",
      });
      return;
    }

    const campaignData: any = {
      Title: title,
      Description: description,
      Location: location,
      TargetAttendees: normalizedTargetAttendees,
      TargetUnits: normalizedTargetUnits,
      Latitude: latitude ? parseFloat(latitude) : null,
      Longitude: longitude ? parseFloat(longitude) : null,
      StartDate: new Date(startDate),
      EndDate: new Date(endDate),
      OrganizationId: organization.OrganizationId,
      IsCollaborativeCampaign:
        isCollaborativeCampaignFromBody ||
        collaboratorOrganizationIds.length > 0,
      ...(typeof collaborationNote === "string" &&
      collaborationNote.trim().length > 0
        ? { CollaborationNote: collaborationNote.trim() }
        : {}),
    };

    if (posterFile) {
      campaignData.PosterUrl = posterFile.path.replace(/\\/g, "/");
    }

    const campaign = await prisma.campaign.create({
      data: campaignData,
    });

    if (collaboratorOrganizationIds.length > 0) {
      await upsertCampaignInvitations(
        campaign.CampaignId,
        organization.OrganizationId,
        collaboratorOrganizationIds,
        typeof collaborationNote === "string"
          ? collaborationNote.trim()
          : undefined,
      );
    }

    const campaignWithRelations = await prisma.campaign.findUnique({
      where: { CampaignId: campaign.CampaignId },
      include: {
        organization: {
          include: {
            user: true,
          },
        },
        collaborations: {
          include: {
            organization: true,
          },
        },
      },
    });

    const io = req.app.get("socketio");
    const shouldBroadcastNewCampaign = !campaign.IsCollaborativeCampaign;
    if (io && shouldBroadcastNewCampaign) {
      io.emit("newCampaign", {
        type: "campaign",
        message: `New Campaign: ${title} by ${organization.OrganizationName}`,
        campaignId: campaign.CampaignId,
        posterUrl: getFullImageUrl(campaign.PosterUrl),
      });
    }

    res.status(201).json({
      message: "Campaign created successfully",
      campaign: campaignWithRelations
        ? mapCampaign(campaignWithRelations)
        : mapCampaign(campaign),
    });
  },
);

export const getMyCampaigns = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { OrganizationId: organization.OrganizationId },
          {
            collaborations: {
              some: {
                OrganizationId: organization.OrganizationId,
                Status: "accepted",
              },
            },
          },
        ],
      },
      include: {
        organization: {
          include: {
            user: true,
          },
        },
        collaborations: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: { StartDate: "desc" },
    });

    res.status(200).json({ campaigns: campaigns.map(mapCampaign) });
  },
);

export const getAllCampaigns = catchAsync(
  async (req: Request, res: Response) => {
    const userRole = String(req.user?.role || "").toLowerCase();
    const shouldHidePendingCollaborativeCampaigns =
      userRole === "donor" || userRole === "gainer";

    const whereClause = shouldHidePendingCollaborativeCampaigns
      ? {
          OR: [
            { IsCollaborativeCampaign: false },
            {
              collaborations: {
                some: {
                  Status: "accepted",
                },
              },
            },
          ],
        }
      : {};

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        organization: {
          include: {
            user: true,
          },
        },
        collaborations: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: {
        StartDate: "asc",
      },
    });

    res.status(200).json({ campaigns: campaigns.map(mapCampaign) });
  },
);

export const updateCampaign = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const campaignId = Number(id);
    const {
      title,
      description,
      location,
      targetAttendees,
      targetUnits,
      latitude,
      longitude,
      startDate,
      endDate,
      collaborationNote,
    } = req.body;
    const hasCollaboratorPayload =
      typeof req.body.collaboratorOrganizationIds !== "undefined";
    const collaboratorOrganizationIds = parseOrganizationIds(
      req.body.collaboratorOrganizationIds,
    );
    const isCollaborativeCampaignFromBody =
      String(req.body.isCollaborativeCampaign || "").toLowerCase() === "true";
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      res.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res
        .status(403)
        .json({ message: "Only organizations can update campaigns" });
      return;
    }

    const existingCampaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignId },
    });

    if (!existingCampaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }

    if (existingCampaign.OrganizationId !== organization.OrganizationId) {
      res
        .status(403)
        .json({ message: "You can only update your own campaigns" });
      return;
    }

    const posterFile = req.file;
    const hasTargetAttendeesPayload = typeof targetAttendees !== "undefined";
    const hasTargetUnitsPayload = typeof targetUnits !== "undefined";
    const normalizedTargetAttendees = parsePositiveInteger(targetAttendees);
    const normalizedTargetUnits = parsePositiveInteger(targetUnits);

    if (
      hasTargetAttendeesPayload &&
      hasProvidedValue(targetAttendees) &&
      normalizedTargetAttendees === null
    ) {
      res.status(400).json({
        message: "targetAttendees must be a positive whole number",
      });
      return;
    }

    if (
      hasTargetUnitsPayload &&
      hasProvidedValue(targetUnits) &&
      normalizedTargetUnits === null
    ) {
      res.status(400).json({
        message: "targetUnits must be a positive whole number",
      });
      return;
    }
    const updateData: any = {
      Title: title,
      Description: description,
      Location: location,
      Latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
      Longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
      StartDate: new Date(startDate),
      EndDate: new Date(endDate),
    };

    if (updateData.Latitude === undefined) delete updateData.Latitude;
    if (updateData.Longitude === undefined) delete updateData.Longitude;

    if (hasTargetAttendeesPayload) {
      updateData.TargetAttendees = normalizedTargetAttendees;
    }

    if (hasTargetUnitsPayload) {
      updateData.TargetUnits = normalizedTargetUnits;
    }

    if (posterFile) {
      updateData.PosterUrl = posterFile.path.replace(/\\/g, "/");
    }

    if (typeof collaborationNote === "string") {
      updateData.CollaborationNote =
        collaborationNote.trim().length > 0 ? collaborationNote.trim() : null;
    }

    if (hasCollaboratorPayload) {
      updateData.IsCollaborativeCampaign =
        isCollaborativeCampaignFromBody ||
        collaboratorOrganizationIds.length > 0;
    } else if (isCollaborativeCampaignFromBody) {
      updateData.IsCollaborativeCampaign = true;
    }

    await prisma.campaign.update({
      where: { CampaignId: campaignId },
      data: updateData,
    });

    if (hasCollaboratorPayload) {
      await syncCampaignInvitations(
        campaignId,
        organization.OrganizationId,
        collaboratorOrganizationIds,
        typeof collaborationNote === "string"
          ? collaborationNote.trim()
          : undefined,
      );
    }

    const updatedCampaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignId },
      include: {
        organization: {
          include: {
            user: true,
          },
        },
        collaborations: {
          include: {
            organization: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Campaign updated successfully",
      campaign: updatedCampaign ? mapCampaign(updatedCampaign) : null,
    });
  },
);

export const deleteCampaign = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const campaignId = Number(id);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      res.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res
        .status(403)
        .json({ message: "Only organizations can delete campaigns" });
      return;
    }

    const existingCampaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignId },
    });

    if (!existingCampaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }

    if (existingCampaign.OrganizationId !== organization.OrganizationId) {
      res
        .status(403)
        .json({ message: "You can only delete your own campaigns" });
      return;
    }

    await prisma.campaign.delete({
      where: { CampaignId: campaignId },
    });

    res.status(200).json({ message: "Campaign deleted successfully" });
  },
);

export const inviteOrganizationsForCampaign = catchAsync(
  async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const campaignIdNumber = Number(campaignId);
    const { organizationIds, message } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!Number.isInteger(campaignIdNumber) || campaignIdNumber <= 0) {
      res.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const inviterOrganization = await getOrganizationByUserId(userId);

    if (!inviterOrganization) {
      res
        .status(403)
        .json({ message: "Only organizations can invite collaborators" });
      return;
    }

    const campaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignIdNumber },
    });

    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }

    if (campaign.OrganizationId !== inviterOrganization.OrganizationId) {
      res.status(403).json({
        message: "You can only invite collaborators for your own campaigns",
      });
      return;
    }

    const normalizedOrganizationIds = parseOrganizationIds(organizationIds);

    if (normalizedOrganizationIds.length === 0) {
      res
        .status(400)
        .json({ message: "At least one valid organization id is required" });
      return;
    }

    const organizations = await prisma.organization.findMany({
      where: {
        OrganizationId: {
          in: normalizedOrganizationIds,
        },
      },
      select: {
        OrganizationId: true,
        OrganizationName: true,
      },
    });

    const foundOrganizationIds = new Set(
      organizations.map((org) => org.OrganizationId),
    );
    const invalidOrganizationIds = normalizedOrganizationIds.filter(
      (orgId) => !foundOrganizationIds.has(orgId),
    );

    if (invalidOrganizationIds.length > 0) {
      res.status(404).json({
        message: "Some organizations were not found",
        invalidOrganizationIds,
      });
      return;
    }

    const inviteResult = await upsertCampaignInvitations(
      campaignIdNumber,
      inviterOrganization.OrganizationId,
      normalizedOrganizationIds,
      typeof message === "string" ? message.trim() : undefined,
    );

    await prisma.campaign.update({
      where: { CampaignId: campaignIdNumber },
      data: {
        IsCollaborativeCampaign: true,
        ...(typeof message === "string" && message.trim().length > 0
          ? { CollaborationNote: message.trim() }
          : {}),
      },
    });

    res.status(200).json({
      message: "Collaboration invitations processed successfully",
      campaignId: campaignIdNumber,
      invitedOrganizations: organizations,
      summary: inviteResult,
    });
  },
);

export const getCampaignInvitations = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res
        .status(403)
        .json({ message: "Only organizations can view campaign invitations" });
      return;
    }

    const invitations = await prisma.campaignCollaboration.findMany({
      where: {
        OrganizationId: organization.OrganizationId,
      },
      include: {
        campaign: {
          include: {
            organization: true,
          },
        },
        invitedBy: true,
      },
      orderBy: {
        CreatedAt: "desc",
      },
    });

    const formattedInvitations = invitations.map((invitation) => ({
      invitationId: invitation.CollaborationId,
      status: invitation.Status,
      message: invitation.Message,
      responseMessage: invitation.ResponseMessage,
      invitedAt: invitation.CreatedAt,
      respondedAt: invitation.RespondedAt,
      campaign: {
        id: String(invitation.campaign.CampaignId),
        title: invitation.campaign.Title,
        description: invitation.campaign.Description,
        location: invitation.campaign.Location,
        startDate: invitation.campaign.StartDate,
        endDate: invitation.campaign.EndDate,
        organizationName: invitation.campaign.organization.OrganizationName,
      },
      invitedByOrganization: {
        id: invitation.invitedBy.OrganizationId,
        name: invitation.invitedBy.OrganizationName,
      },
    }));

    res.status(200).json({ invitations: formattedInvitations });
  },
);

export const respondToCampaignInvitation = catchAsync(
  async (req: Request, res: Response) => {
    const { invitationId } = req.params;
    const invitationIdNumber = Number(invitationId);
    const { action, status, responseMessage } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!Number.isInteger(invitationIdNumber) || invitationIdNumber <= 0) {
      res.status(400).json({ message: "Invalid invitation id" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res.status(403).json({
        message: "Only organizations can respond to campaign invitations",
      });
      return;
    }

    const rawDecision = String(action || status || "").toLowerCase();
    const normalizedDecision =
      rawDecision === "accept" || rawDecision === "accepted"
        ? "accepted"
        : rawDecision === "reject" || rawDecision === "rejected"
          ? "rejected"
          : null;

    if (!normalizedDecision) {
      res.status(400).json({
        message: "Decision must be accept/accepted or reject/rejected",
      });
      return;
    }

    const invitation = await prisma.campaignCollaboration.findUnique({
      where: { CollaborationId: invitationIdNumber },
      include: {
        campaign: true,
      },
    });

    if (!invitation) {
      res.status(404).json({ message: "Invitation not found" });
      return;
    }

    if (invitation.OrganizationId !== organization.OrganizationId) {
      res.status(403).json({
        message:
          "You can only respond to invitations sent to your organization",
      });
      return;
    }

    const updatedInvitation = await prisma.campaignCollaboration.update({
      where: { CollaborationId: invitationIdNumber },
      data: {
        Status: normalizedDecision,
        RespondedAt: new Date(),
        ...(typeof responseMessage === "string"
          ? {
              ResponseMessage:
                responseMessage.trim().length > 0
                  ? responseMessage.trim()
                  : null,
            }
          : {}),
      },
      include: {
        campaign: {
          include: {
            organization: true,
          },
        },
        organization: true,
        invitedBy: true,
      },
    });

    if (normalizedDecision === "accepted") {
      await prisma.campaign.update({
        where: { CampaignId: updatedInvitation.CampaignId },
        data: {
          IsCollaborativeCampaign: true,
        },
      });
    }

    res.status(200).json({
      message: `Invitation ${normalizedDecision} successfully`,
      invitation: {
        invitationId: updatedInvitation.CollaborationId,
        status: updatedInvitation.Status,
        message: updatedInvitation.Message,
        responseMessage: updatedInvitation.ResponseMessage,
        invitedAt: updatedInvitation.CreatedAt,
        respondedAt: updatedInvitation.RespondedAt,
        campaign: {
          id: String(updatedInvitation.campaign.CampaignId),
          title: updatedInvitation.campaign.Title,
          location: updatedInvitation.campaign.Location,
          organizationName:
            updatedInvitation.campaign.organization.OrganizationName,
        },
        organization: {
          id: updatedInvitation.organization.OrganizationId,
          name: updatedInvitation.organization.OrganizationName,
        },
        invitedByOrganization: {
          id: updatedInvitation.invitedBy.OrganizationId,
          name: updatedInvitation.invitedBy.OrganizationName,
        },
      },
    });
  },
);

export const getCampaignReport = catchAsync(
  async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const campaignIdNumber = Number(campaignId);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!Number.isInteger(campaignIdNumber) || campaignIdNumber <= 0) {
      res.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const organization = await getOrganizationByUserId(userId);

    if (!organization) {
      res
        .status(403)
        .json({ message: "Only organizations can access campaign reports" });
      return;
    }

    const campaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignIdNumber },
      include: {
        organization: {
          include: {
            user: true,
          },
        },
        collaborations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }

    const isOwner = campaign.OrganizationId === organization.OrganizationId;
    const isAcceptedCollaborator = campaign.collaborations.some(
      (collaboration) =>
        collaboration.OrganizationId === organization.OrganizationId &&
        collaboration.Status === "accepted",
    );

    if (!isOwner && !isAcceptedCollaborator) {
      res.status(403).json({
        message: "You are not authorized to view this campaign report",
      });
      return;
    }

    const attendances = await prisma.campAttendance.findMany({
      where: { CampaignId: campaignIdNumber },
      include: {
        user: {
          select: {
            FullName: true,
            Email: true,
            Phone: true,
          },
        },
      },
      orderBy: { CreatedAt: "desc" },
    });

    const attendees = attendances.map((attendance) => ({
      id: attendance.AttendanceId,
      fullName: attendance.user.FullName,
      email: attendance.user.Email,
      phone: attendance.user.Phone,
      bloodType: attendance.BloodType,
      units: attendance.Units,
      attendedAt: attendance.CreatedAt,
    }));

    const totalUnits = attendees.reduce(
      (sum, attendee) => sum + (Number(attendee.units) || 0),
      0,
    );

    const collaborationPartners = campaign.collaborations
      .filter((collaboration) => collaboration.Status === "accepted")
      .map((collaboration) => collaboration.organization.OrganizationName);

    res.status(200).json({
      report: {
        campaignId: String(campaign.CampaignId),
        title: campaign.Title,
        organizationName: campaign.organization.OrganizationName,
        organizationPhone:
          campaign.organization.Contact || campaign.organization.user.Phone,
        organizationEmail: campaign.organization.user.Email,
        collaborationNote: campaign.CollaborationNote,
        targetAttendees: campaign.TargetAttendees,
        targetUnits: campaign.TargetUnits,
        collaborationPartners,
        attendees,
        totalAttendees: attendees.length,
        totalUnits,
        attendeesGoalHitPercent:
          campaign.TargetAttendees && campaign.TargetAttendees > 0
            ? Math.min(
                100,
                Math.round((attendees.length / campaign.TargetAttendees) * 100),
              )
            : null,
        unitsGoalHitPercent:
          campaign.TargetUnits && campaign.TargetUnits > 0
            ? Math.min(
                100,
                Math.round((totalUnits / campaign.TargetUnits) * 100),
              )
            : null,
        generatedAt: new Date().toISOString(),
      },
    });
  },
);

export const recordAttendance = catchAsync(
  async (req: Request, res: Response) => {
    const { campaignId, userId, bloodType, units } = req.body;
    const authUserId = req.user?.userId;

    if (!authUserId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const campaignIdNumber = Number(campaignId);
    if (!Number.isInteger(campaignIdNumber) || campaignIdNumber <= 0) {
      res.status(400).json({ message: "Invalid campaign id" });
      return;
    }

    const targetUserId = String(userId || authUserId);
    const normalizedUnits = Number(units) || 1;

    const campaign = await prisma.campaign.findUnique({
      where: { CampaignId: campaignIdNumber },
      include: { organization: true },
    });

    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }

    const existingAttendance = await prisma.campAttendance.findFirst({
      where: {
        CampaignId: campaignIdNumber,
        UserId: targetUserId,
      },
    });

    if (existingAttendance) {
      res.status(400).json({ message: "You have already attended this camp!" });
      return;
    }

    const attendance = await prisma.campAttendance.create({
      data: {
        CampaignId: campaignIdNumber,
        UserId: targetUserId,
        BloodType: bloodType,
        Units: normalizedUnits,
      },
    });

    const organizationId = campaign.OrganizationId;
    const existingInventory = await prisma.inventory.findFirst({
      where: {
        OrganizationId: organizationId,
        BloodType: bloodType,
      },
    });

    if (existingInventory) {
      await prisma.inventory.update({
        where: { InventoryId: existingInventory.InventoryId },
        data: { Units: existingInventory.Units + normalizedUnits },
      });

      await logInventoryChange(
        organizationId,
        bloodType,
        normalizedUnits,
        "Campaign",
        existingInventory.Units,
        existingInventory.Units + normalizedUnits,
        attendance.AttendanceId,
      );
    } else {
      await prisma.inventory.create({
        data: {
          OrganizationId: organizationId,
          BloodType: bloodType,
          Units: normalizedUnits,
        },
      });

      await logInventoryChange(
        organizationId,
        bloodType,
        normalizedUnits,
        "Campaign",
        0,
        normalizedUnits,
        attendance.AttendanceId,
      );
    }

    const io = req.app.get("socketio");
    if (io) {
      await createNotification(
        targetUserId,
        "Thank You for Your Contribution!",
        `Your donation at ${campaign.Title} is highly appreciated. You've helped save lives!`,
        "donation_thankyou",
        attendance.AttendanceId,
        io,
      );
    }

    res.status(201).json({
      message: "Attendance recorded and inventory updated successfully",
      attendance,
    });
  },
);

export const getAttendees = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaignIdNumber = Number(id);
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: "User not authenticated" });
    return;
  }

  if (!Number.isInteger(campaignIdNumber) || campaignIdNumber <= 0) {
    res.status(400).json({ message: "Invalid campaign id" });
    return;
  }

  const organization = await getOrganizationByUserId(userId);

  if (!organization) {
    res.status(403).json({ message: "Only organizations can view attendees" });
    return;
  }

  const campaign = await prisma.campaign.findUnique({
    where: { CampaignId: campaignIdNumber },
    include: {
      collaborations: true,
    },
  });

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  const isOwner = campaign.OrganizationId === organization.OrganizationId;
  const isAcceptedCollaborator = campaign.collaborations.some(
    (collaboration) =>
      collaboration.OrganizationId === organization.OrganizationId &&
      collaboration.Status === "accepted",
  );

  if (!isOwner && !isAcceptedCollaborator) {
    res.status(403).json({
      message: "You are not authorized to view attendees for this campaign",
    });
    return;
  }

  const attendances = await prisma.campAttendance.findMany({
    where: { CampaignId: campaignIdNumber },
    include: {
      user: {
        select: {
          FullName: true,
          Email: true,
          Phone: true,
        },
      },
    },
    orderBy: { CreatedAt: "desc" },
  });

  const attendees = attendances.map((attendance) => ({
    id: attendance.AttendanceId,
    fullName: attendance.user.FullName,
    email: attendance.user.Email,
    phone: attendance.user.Phone,
    bloodType: attendance.BloodType,
    units: attendance.Units,
    attendedAt: attendance.CreatedAt,
  }));

  res.status(200).json({ attendees });
});
