import express from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
} from '../controllers/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/register', catchAsync(register)); //US-1
router.post('/verify-otp', catchAsync(verifyOTP));//US-2
router.post('/resend-otp', catchAsync(resendOTP));//US-2

export default router;

