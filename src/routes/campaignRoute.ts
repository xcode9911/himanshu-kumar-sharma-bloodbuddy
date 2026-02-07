import express from "express";
import { createCampaign, deleteCampaign, getAllCampaigns, getMyCampaigns, updateCampaign, upload } from "../controllers/campaignController.js";
import { authenticateUser } from "../utils/authMiddleware.js";

const router = express.Router();

// Public route to view all campaigns
router.get("/all", authenticateUser, getAllCampaigns);

// Organization specific routes
router.get("/my-campaigns", authenticateUser, getMyCampaigns);

// Organization only routes
router.post("/create", authenticateUser, upload.single("poster"), createCampaign);
router.put("/:id", authenticateUser, upload.single("poster"), updateCampaign);
router.delete("/:id", authenticateUser, deleteCampaign);

export default router;
