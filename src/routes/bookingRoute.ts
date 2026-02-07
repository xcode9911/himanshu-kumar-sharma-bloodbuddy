import express from 'express';
import { approveBooking, createBooking, getOrganizationBookings, rejectBooking } from '../controllers/bookingController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/create', catchAsync(createBooking));
router.get('/getBooking', catchAsync(getOrganizationBookings));
router.patch('/approve/:requestId', catchAsync(approveBooking));
router.patch('/reject/:requestId', catchAsync(rejectBooking));

export default router;
