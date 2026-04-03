import express from "express";
import {
    createCampaign,
    deleteCampaign,
    getAllCampaigns,
    getAttendees,
    getCampaignInvitations,
    getCampaignReport,
    getMyCampaigns,
    inviteOrganizationsForCampaign,
    recordAttendance,
    respondToCampaignInvitation,
    updateCampaign,
    upload,
} from "../controllers/campaignController.js";
import { authenticateUser } from "../utils/authMiddleware.js";

const router = express.Router();

// Public route to view all campaigns
router.get("/all", authenticateUser, getAllCampaigns);

// Organization specific routes
router.get("/my-campaigns", authenticateUser, getMyCampaigns);
router.get("/invitations", authenticateUser, getCampaignInvitations);
router.post("/invitations/:invitationId/respond",authenticateUser,respondToCampaignInvitation,);

// Organization only routes
router.post("/create",authenticateUser,upload.single("poster"),createCampaign,);
router.post("/:campaignId/invite-organizations",authenticateUser,inviteOrganizationsForCampaign,);
router.get("/:campaignId/report", authenticateUser, getCampaignReport);
router.put("/:id", authenticateUser, upload.single("poster"), updateCampaign);
router.delete("/:id", authenticateUser, deleteCampaign);

// Attendance routes
router.post("/record-attendance", authenticateUser, recordAttendance);
router.get("/attendees/:id", authenticateUser, getAttendees);

export default router;
