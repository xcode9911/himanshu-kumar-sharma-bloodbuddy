import express from 'express';
import { createBloodRequest, cancelBloodRequest, getBookingsByUserId } from '../controllers/requestController.js';

const router = express.Router();

router.post('/create', createBloodRequest);
router.post('/cancel', cancelBloodRequest);
router.get('/user/:userId', getBookingsByUserId);

export default router;
