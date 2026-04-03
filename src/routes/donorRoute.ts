import express from 'express';
import { getAllDonors, getLeaderboard, setDonorAvailability } from '../controllers/donorController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.put('/availability', catchAsync(setDonorAvailability)); // Set donor availability
router.get('/getDonors', catchAsync(getAllDonors)); // Get all donors (Public/Gainer)
router.get('/leaderboard', catchAsync(getLeaderboard)); // Get Leaderboard

export default router;
