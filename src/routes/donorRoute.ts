import express from 'express';
import { getAllDonors, getCompatibleDonors, getLeaderboard, setDonorAvailability } from '../controllers/donorController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.put('/availability', catchAsync(setDonorAvailability)); // Set donor availability
router.get('/getDonors', catchAsync(getAllDonors)); // Get all donors with optional filters (?bloodType=, ?location=, ?availableOnly=true)
router.get('/compatible/:bloodType', catchAsync(getCompatibleDonors)); // Get donors compatible with a given recipient blood type
router.get('/leaderboard', catchAsync(getLeaderboard)); // Get Leaderboard

export default router;
