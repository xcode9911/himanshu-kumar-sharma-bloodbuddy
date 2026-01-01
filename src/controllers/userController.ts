import type { Request, Response } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';
import { sendOTPEmail, sendPasswordResetOTPEmail } from '../utils/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';
const OTP_EXPIRY_MINUTES = 10;

// Helper function to generate OTP
const generateOTP = (): string => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// Helper function to hash password
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// Helper function to compare password
const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Build a safe user payload for JWT (no passwords)
const buildUserPayload = (user: any) => {
  const base: any = {
    userId: user.UserId,
    email: user.Email,
    fullName: user.FullName,
    role: user.Role,
    phone: user.Phone,
    createdAt: user.CreatedAt,
  };

  if (user.Role === 'donor' && user.donor) {
    base.donor = {
      donorId: user.donor.DonorId,
      bloodType: user.donor.BloodType,
      eligibilityStatus: user.donor.EligibilityStatus,
      location: user.donor.Location,
      lastDonationDate: user.donor.LastDonationDate,
    };
  } else if (user.Role === 'gainer' && user.gainer) {
    base.gainer = {
      gainerId: user.gainer.GainerId,
      address: user.gainer.Address,
    };
  } else if (user.Role === 'organization' && user.organization) {
    base.organization = {
      organizationId: user.organization.OrganizationId,
      organizationName: user.organization.OrganizationName,
      location: user.organization.Location,
      contact: user.organization.Contact,
    };
  }

  return base;
};

// Helper function to generate JWT token with full user payload
const generateToken = (user: any): string => {
  const payload = buildUserPayload(user);
  return jwt.sign({ user: payload }, JWT_SECRET, { expiresIn: '7d' });
};

// Unified Register Function
export const register = async (req: Request, res: Response) => {
  const { role, fullName, email, password, phone, ...roleSpecificData } = req.body;

  // Validate role
  const validRoles = ['donor', 'gainer', 'organization'];
  if (!role || !validRoles.includes(role.toLowerCase())) {
    return res.status(400).json({ 
      message: 'Invalid role. Must be one of: donor, gainer, organization' 
    });
  }

  const userRole = role.toLowerCase();

  // Common required fields validation
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields: fullName, email, password' });
  }

  // Role-specific validation
  if (userRole === 'donor') {
    const { bloodType, eligibilityStatus, location } = roleSpecificData;
    if (!bloodType || !eligibilityStatus || !location) {
      return res.status(400).json({ 
        message: 'Missing required fields for donor: bloodType, eligibilityStatus, location' 
      });
    }
  } else if (userRole === 'organization') {
    const { organizationName, location } = roleSpecificData;
    if (!organizationName || !location) {
      return res.status(400).json({ 
        message: 'Missing required fields for organization: organizationName, location' 
      });
    }
  }
  // Gainer only needs fullName, email, password (address is optional)

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { Email: email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Check if there's a pending registration (unverified OTP) for this email
    const pendingOtp = await prisma.otp.findFirst({
      where: {
        Email: email,
        IsUsed: false,
        ExpiresAt: {
          gt: new Date(),
        },
        UserId: null, // No user created yet
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });

    if (pendingOtp) {
      return res.status(400).json({ 
        message: 'Registration already in progress. Please check your email for OTP or use resend OTP.' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Prepare registration data to store temporarily
    const registrationData = {
      fullName,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: userRole,
      roleSpecificData,
    };

    // Generate and store OTP with registration data (NO USER CREATED YET)
    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await prisma.otp.create({
      data: {
        Email: email,
        Code: otpCode,
        ExpiresAt: expiresAt,
        RegistrationData: registrationData as any,
        UserId: null, // No user created yet
      },
    });

    // Send OTP via email
    try {
      await sendOTPEmail(email, otpCode, fullName);
    } catch (emailError: any) {
      console.error('Error sending OTP email:', emailError);
      // Delete the OTP record if email fails
      await prisma.otp.deleteMany({
        where: {
          Email: email,
          Code: otpCode,
        },
      });
      return res.status(500).json({ 
        message: 'Failed to send OTP email. Please try again.' 
      });
    }

    const roleMessages: Record<string, string> = {
      donor: 'Registration initiated. Please check your email for the OTP verification code to complete registration.',
      gainer: 'Registration initiated. Please check your email for the OTP verification code to complete registration.',
      organization: 'Registration initiated. Please check your email for the OTP verification code to complete registration.',
    };

    return res.status(201).json({
      message: roleMessages[userRole],
      email: email,
    });
  } catch (error: any) {
    console.error(`Error registering ${userRole}:`, error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Email already in use' });
    }
    return res.status(500).json({ 
      message: `Error registering ${userRole}`, 
      error: error.message 
    });
  }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if user already exists (for existing users)
    const existingUser = await prisma.user.findUnique({
      where: { Email: email },
    });

    if (existingUser) {
      // User exists - generate new OTP for login/reset
      const otpCode = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      await prisma.otp.create({
        data: {
          Email: email,
          Code: otpCode,
          ExpiresAt: expiresAt,
          UserId: existingUser.UserId,
        },
      });

      try {
        await sendOTPEmail(existingUser.Email, otpCode, existingUser.FullName);
        return res.status(200).json({
          message: 'OTP has been resent to your email address.',
        });
      } catch (emailError: any) {
        console.error('Error sending OTP email:', emailError);
        return res.status(500).json({
          message: 'Failed to send OTP email. Please try again later.',
        });
      }
    }

    // User doesn't exist - check for pending registration
    const pendingOtp = await prisma.otp.findFirst({
      where: {
        Email: email,
        IsUsed: false,
        UserId: null, // No user created yet
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });

    if (!pendingOtp || !pendingOtp.RegistrationData) {
      return res.status(404).json({ 
        message: 'No pending registration found. Please register first.' 
      });
    }

    // Check if OTP is expired
    if (new Date() > pendingOtp.ExpiresAt) {
      // Generate new OTP with same registration data
      const registrationData = pendingOtp.RegistrationData as any;
      const otpCode = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      // Delete old OTP and create new one
      await prisma.otp.delete({
        where: { OtpId: pendingOtp.OtpId },
      });

      await prisma.otp.create({
        data: {
          Email: email,
          Code: otpCode,
          ExpiresAt: expiresAt,
          RegistrationData: registrationData,
          UserId: null,
        },
      });

      try {
        await sendOTPEmail(email, otpCode, registrationData.fullName);
        return res.status(200).json({
          message: 'OTP has been resent to your email address.',
        });
      } catch (emailError: any) {
        console.error('Error sending OTP email:', emailError);
        return res.status(500).json({
          message: 'Failed to send OTP email. Please try again later.',
        });
      }
    }

    // OTP still valid - resend the same code
    try {
      const registrationData = pendingOtp.RegistrationData as any;
      await sendOTPEmail(email, pendingOtp.Code, registrationData.fullName);
      return res.status(200).json({
        message: 'OTP has been resent to your email address.',
      });
    } catch (emailError: any) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({
        message: 'Failed to send OTP email. Please try again later.',
      });
    }
  } catch (error: any) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({ message: 'Error resending OTP', error: error.message });
  }
};

// Verify OTP
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and OTP code are required' });
  }

  try {
    // Find the most recent unused OTP for this email
    const otp = await prisma.otp.findFirst({
      where: {
        Email: email,
        Code: code,
        IsUsed: false,
        ExpiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        CreatedAt: 'desc',
      },
    });

    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // If user already exists (for resend OTP scenario), just verify and return token
    if (otp.UserId) {
      const user = await prisma.user.findUnique({
        where: { UserId: otp.UserId },
        include: {
          donor: true,
          gainer: true,
          organization: true,
        },
      });

      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Mark OTP as used
      await prisma.otp.update({
        where: { OtpId: otp.OtpId },
        data: { IsUsed: true },
      });

      const userPayload = buildUserPayload(user);
      const token = generateToken(user);

      return res.status(200).json({
        message: 'OTP verified successfully',
        token,
        user: userPayload,
      });
    }

    // If no user exists, this is a new registration - create user from registration data
    if (!otp.RegistrationData) {
      return res.status(400).json({ message: 'Registration data not found' });
    }

    const registrationData = otp.RegistrationData as any;
    const { fullName, password, phone, role, roleSpecificData } = registrationData;

    // Create user and role-specific record in a transaction
    const result = await prisma.$transaction(async (tx: PrismaClient) => {
      const user = await tx.user.create({
        data: {
          FullName: fullName,
          Email: email,
          Password: password, // Already hashed
          Phone: phone,
          Role: role,
        },
      });

      let roleSpecificRecord: any = null;

      // Create role-specific record
      if (role === 'donor') {
        const { bloodType, eligibilityStatus, location, lastDonationDate } = roleSpecificData;
        roleSpecificRecord = await tx.donor.create({
          data: {
            UserId: user.UserId,
            BloodType: bloodType,
            EligibilityStatus: eligibilityStatus,
            Location: location,
            LastDonationDate: lastDonationDate ? new Date(lastDonationDate) : null,
          },
        });
      } else if (role === 'gainer') {
        const { address } = roleSpecificData;
        roleSpecificRecord = await tx.gainer.create({
          data: {
            UserId: user.UserId,
            Address: address || null,
          },
        });
      } else if (role === 'organization') {
        const { organizationName, location, contact } = roleSpecificData;
        roleSpecificRecord = await tx.organization.create({
          data: {
            UserId: user.UserId,
            OrganizationName: organizationName,
            Location: location,
            Contact: contact || null,
          },
        });
      }

      // Update OTP to link with user and mark as used
      await tx.otp.update({
        where: { OtpId: otp.OtpId },
        data: { 
          IsUsed: true,
          UserId: user.UserId,
        },
      });

      return { user, roleSpecificRecord };
    });

    const createdUser = await prisma.user.findUnique({
      where: { UserId: result.user.UserId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (!createdUser) {
      return res.status(500).json({ message: 'User created but failed to load profile' });
    }

    const userPayload = buildUserPayload(createdUser);
    const token = generateToken(createdUser);

    return res.status(200).json({
      message: 'OTP verified successfully. Account created.',
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    return res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }

  // Validate role
  const validRoles = ['donor', 'gainer', 'organization'];
  const userRole = role.toLowerCase();
  if (!validRoles.includes(userRole)) {
    return res.status(400).json({ 
      message: 'Invalid role. Must be one of: donor, gainer, organization' 
    });
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { Email: email },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify that the provided role matches the user's actual role
    if (user.Role.toLowerCase() !== userRole) {
      return res.status(403).json({ 
        message: `Invalid role. This account is registered as ${user.Role}, not ${userRole}` 
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.Password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const userData = buildUserPayload(user);
    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: userData,
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Error during login', error: error.message });
  }
};

// Request Password Reset (send OTP)
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      // To avoid user enumeration, return success message regardless
      return res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
    }

    const otpCode = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await prisma.otp.create({
      data: {
        Email: user.Email,
        Code: otpCode,
        ExpiresAt: expiresAt,
        UserId: user.UserId,
      },
    });

    try {
      await sendPasswordResetOTPEmail(user.Email, otpCode, user.FullName);
    } catch (emailError: any) {
      console.error('Error sending password reset OTP email:', emailError);
      // Avoid leaking details, still return generic success
    }

    return res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
  } catch (error: any) {
    console.error('Error requesting password reset:', error);
    return res.status(500).json({ message: 'Error requesting password reset', error: error.message });
  }
};

// Reset Password using OTP
export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP code, and newPassword are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or OTP' });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        Email: email,
        Code: code,
        IsUsed: false,
        ExpiresAt: { gt: new Date() },
        UserId: user.UserId,
      },
      orderBy: { CreatedAt: 'desc' },
    });

    if (!otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const hashed = await hashPassword(newPassword);

    await prisma.$transaction(async (tx: PrismaClient) => {
      await tx.user.update({
        where: { UserId: user.UserId },
        data: { Password: hashed },
      });

      await tx.otp.update({
        where: { OtpId: otp.OtpId },
        data: { IsUsed: true },
      });

      // Optionally invalidate other active reset OTPs for this user
      await tx.otp.updateMany({
        where: {
          UserId: user.UserId,
          IsUsed: false,
          ExpiresAt: { gt: new Date() },
          Email: email,
          OtpId: { not: otp.OtpId },
        },
        data: { IsUsed: true },
      });
    });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

// Update User Profile
export const updateProfile = async (req: Request, res: Response) => {
  const { userId, fullName, phone, password, ...roleSpecificData } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Find existing user
    const existingUser = await prisma.user.findUnique({
      where: { UserId: userId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare user update data
    const userUpdateData: any = {};
    if (fullName) userUpdateData.FullName = fullName;
    if (phone !== undefined) userUpdateData.Phone = phone;
    if (password) {
      userUpdateData.Password = await hashPassword(password);
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx: PrismaClient) => {
      // Update user table
      const updatedUser = await tx.user.update({
        where: { UserId: userId },
        data: userUpdateData,
      });

      let roleSpecificRecord: any = null;

      // Update role-specific data
      if (existingUser.Role === 'donor' && existingUser.donor) {
        const donorUpdateData: any = {};
        if (roleSpecificData.bloodType) donorUpdateData.BloodType = roleSpecificData.bloodType;
        if (roleSpecificData.eligibilityStatus) donorUpdateData.EligibilityStatus = roleSpecificData.eligibilityStatus;
        if (roleSpecificData.location) donorUpdateData.Location = roleSpecificData.location;
        if (roleSpecificData.lastDonationDate) {
          donorUpdateData.LastDonationDate = new Date(roleSpecificData.lastDonationDate);
        }

        if (Object.keys(donorUpdateData).length > 0) {
          roleSpecificRecord = await tx.donor.update({
            where: { DonorId: existingUser.donor.DonorId },
            data: donorUpdateData,
          });
        }
      } else if (existingUser.Role === 'gainer' && existingUser.gainer) {
        const gainerUpdateData: any = {};
        if (roleSpecificData.address !== undefined) gainerUpdateData.Address = roleSpecificData.address;

        if (Object.keys(gainerUpdateData).length > 0) {
          roleSpecificRecord = await tx.gainer.update({
            where: { GainerId: existingUser.gainer.GainerId },
            data: gainerUpdateData,
          });
        }
      } else if (existingUser.Role === 'organization' && existingUser.organization) {
        const orgUpdateData: any = {};
        if (roleSpecificData.organizationName) orgUpdateData.OrganizationName = roleSpecificData.organizationName;
        if (roleSpecificData.location) orgUpdateData.Location = roleSpecificData.location;
        if (roleSpecificData.contact !== undefined) orgUpdateData.Contact = roleSpecificData.contact;

        if (Object.keys(orgUpdateData).length > 0) {
          roleSpecificRecord = await tx.organization.update({
            where: { OrganizationId: existingUser.organization.OrganizationId },
            data: orgUpdateData,
          });
        }
      }

      return { updatedUser, roleSpecificRecord };
    });

    // Fetch complete updated profile
    const updatedProfile = await prisma.user.findUnique({
      where: { UserId: userId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    let userData: any = {
      userId: updatedProfile!.UserId,
      email: updatedProfile!.Email,
      fullName: updatedProfile!.FullName,
      role: updatedProfile!.Role,
      phone: updatedProfile!.Phone,
      createdAt: updatedProfile!.CreatedAt,
    };

    if (updatedProfile!.Role === 'donor' && updatedProfile!.donor) {
      userData.donor = {
        donorId: updatedProfile!.donor.DonorId,
        bloodType: updatedProfile!.donor.BloodType,
        eligibilityStatus: updatedProfile!.donor.EligibilityStatus,
        location: updatedProfile!.donor.Location,
        lastDonationDate: updatedProfile!.donor.LastDonationDate,
      };
    } else if (updatedProfile!.Role === 'gainer' && updatedProfile!.gainer) {
      userData.gainer = {
        gainerId: updatedProfile!.gainer.GainerId,
        address: updatedProfile!.gainer.Address,
      };
    } else if (updatedProfile!.Role === 'organization' && updatedProfile!.organization) {
      userData.organization = {
        organizationId: updatedProfile!.organization.OrganizationId,
        organizationName: updatedProfile!.organization.OrganizationName,
        location: updatedProfile!.organization.Location,
        contact: updatedProfile!.organization.Contact,
      };
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: userData,
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

