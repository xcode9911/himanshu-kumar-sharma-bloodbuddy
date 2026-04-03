import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
  verifyOTP,
  authenticateInstagram
} from '../controllers/userController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Configure Multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
  }
});

router.post('/register', catchAsync(register)); //US-1
router.post('/verify-otp', catchAsync(verifyOTP));//US-2
router.post('/resend-otp', catchAsync(resendOTP));//US-2
router.post('/login', catchAsync(login));//US-3
router.post('/forgot-password', catchAsync(requestPasswordReset));//US-4
router.post('/reset-password', catchAsync(resetPassword));//US-4
router.put('/profile', upload.single('profileImage'), catchAsync(updateProfile));//US-5
router.post('/eligibility-check', catchAsync(checkEligibility));//us-6&7
router.get('/refresh-token', catchAsync(refreshToken));//Refresh JWT token
router.get('/profile/:userId', catchAsync(getUserProfile)); // Get user profile
router.post('/instagram-auth', catchAsync(authenticateInstagram)); // Instagram OAuth exchange

export default router;

