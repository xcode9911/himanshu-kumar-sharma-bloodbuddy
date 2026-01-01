import express from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  requestPasswordReset,
  resetPassword,
} from '../controllers/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/register', catchAsync(register)); //US-1
router.post('/verify-otp', catchAsync(verifyOTP));//US-2
router.post('/resend-otp', catchAsync(resendOTP));//US-2
router.post('/login', catchAsync(login));//US-3
router.post('/forgot-password', catchAsync(requestPasswordReset));//US-4
router.post('/reset-password', catchAsync(resetPassword));//US-4

export default router;

