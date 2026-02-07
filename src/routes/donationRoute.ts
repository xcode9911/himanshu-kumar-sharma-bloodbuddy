import express from 'express';
import { createDonationOffer, getDonationOffers, getDonorSchedule, getOrgConfirmed, getOrgRequests, updateDonationStatus } from '../controllers/donationController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/create', catchAsync(createDonationOffer));
router.get('/all', catchAsync(getDonationOffers));
router.get('/donor/schedule', catchAsync(getDonorSchedule));
router.get('/organization/requests', catchAsync(getOrgRequests));
router.get('/organization/confirmed', catchAsync(getOrgConfirmed));
router.patch('/update-status/:offerId', catchAsync(updateDonationStatus));

export default router;
