import express from 'express';
import { getAllDonors, setDonorAvailability } from '../controllers/donorController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.put('/availability', catchAsync(setDonorAvailability)); // Set donor availability
router.get('/getDonors', catchAsync(getAllDonors)); // Get all donors (Public/Gainer)

export default router;
