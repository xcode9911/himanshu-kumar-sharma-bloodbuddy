import { Router } from "express";
import { getChatPartners, getMessages, markMessagesAsRead, sendMessage } from "../controllers/chatController.js";
import { authenticateUser } from "../utils/authMiddleware.js";

const router = Router();

// All chat routes require authentication
router.use(authenticateUser);

router.get("/contacts", getChatPartners);
router.get("/messages/:partnerId", getMessages);
router.post("/send", sendMessage);
router.patch("/read/:partnerId", markMessagesAsRead);

export default router;
