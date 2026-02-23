import express from 'express';
import {
  checkEligibility,
  getUserProfile,
  login,
  refreshToken,
  register,
  requestPasswordReset,
  resendOTP,
  resetPassword,
  updateProfile,
  verifyOTP
} from '../controllers/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/register', catchAsync(register)); //US-1
router.post('/verify-otp', catchAsync(verifyOTP));//US-2
router.post('/resend-otp', catchAsync(resendOTP));//US-2
router.post('/login', catchAsync(login));//US-3
router.post('/forgot-password', catchAsync(requestPasswordReset));//US-4
router.post('/reset-password', catchAsync(resetPassword));//US-4
router.put('/profile', catchAsync(updateProfile));//US-5
router.post('/eligibility-check', catchAsync(checkEligibility));//us-6&7
router.get('/refresh-token', catchAsync(refreshToken));//Refresh JWT token
router.get('/profile/:userId', catchAsync(getUserProfile)); // Get user profile

export default router;

