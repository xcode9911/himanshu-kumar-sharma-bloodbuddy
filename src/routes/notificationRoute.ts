import { Router } from 'express';
import { deleteNotification, getNotifications, markAllAsRead, markAsRead } from '../controllers/notificationController.js';

const router = Router();

router.get('/all', getNotifications);
router.patch('/mark-read/:notificationId', markAsRead);
router.patch('/mark-all-read', markAllAsRead);
router.delete('/:notificationId', deleteNotification);

export default router;
