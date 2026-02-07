import express from 'express';
import { setDonorAvailability } from '../controllers/donorController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.put('/availability', catchAsync(setDonorAvailability)); // Set donor availability

export default router;
