import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';
import { buildUserPayload, generateToken } from './userController.js';
import { getFullImageUrl } from '../utils/imageUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

// Extract userId from bearer token; surface missing/invalid states for proper HTTP errors.
const getUserIdFromAuthHeader = (req: Request): { userId: string | null; error?: 'missing' | 'invalid' } => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { userId: null, error: 'missing' };
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    return { userId: null, error: 'invalid' };
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { userId: decoded?.user?.userId ?? null };
  } catch (err) {
    return { userId: null, error: 'invalid' };
  }
};

// Extract full user payload from bearer token (contains donor info)
const getAuthUserFromAuthHeader = (req: Request): { user: any | null; error?: 'missing' | 'invalid' } => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { user: null, error: 'missing' };
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    return { user: null, error: 'invalid' };
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { user: decoded?.user ?? null };
  } catch (err) {
    return { user: null, error: 'invalid' };
  }
};

export const setDonorAvailability = async (req: Request, res: Response) => {
  const { isAvailable } = req.body;
  const { user: authUser, error: authError } = getAuthUserFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUser) {
    return res.status(401).json({ message: 'User payload not found in token' });
  }

  // Validate isAvailable parameter
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ message: 'isAvailable must be a boolean value' });
  }

  // Validate token role and donor presence
  if (String(authUser.role).toLowerCase() !== 'donor' || !authUser.donor) {
    return res.status(400).json({ message: 'Only donors can set availability status' });
  }

  // If trying to set as available, check last donation date
  if (isAvailable) {
    const donor = authUser.donor;

    // Fetch fresh donor data from database to validate eligibility (source of truth)
    const freshDonor = await prisma.donor.findUnique({
      where: { DonorId: donor.donorId },
    });

    if (!freshDonor) {
      return res.status(404).json({ message: 'Donor record not found' });
    }

    // Check eligibility from database
    if (freshDonor.EligibilityStatus !== 'eligible') {
      return res.status(400).json({
        message: 'You must be eligible to donate before setting yourself as available. Please complete the eligibility check first.',
        currentEligibilityStatus: freshDonor.EligibilityStatus,
        hint: 'Go to /api/users/eligibility-check to complete or update your eligibility status.',
      });
    }

    // Check if donor has a LastDonationDate — 56-day cooldown
    if (freshDonor.LastDonationDate) {
      const cooldownMs = 56 * 24 * 60 * 60 * 1000; // 56 days in milliseconds
      const lastDonation = new Date(freshDonor.LastDonationDate).getTime();
      const now = Date.now();

      if (now - lastDonation < cooldownMs) {
        const nextAvailableDate = new Date(lastDonation + cooldownMs);

        return res.status(400).json({
          message: 'You cannot set yourself as available yet. You must wait 56 days after your last donation.',
          lastDonationDate: freshDonor.LastDonationDate,
          nextAvailableDate: nextAvailableDate,
          daysRemaining: Math.ceil((lastDonation + cooldownMs - now) / (24 * 60 * 60 * 1000)),
        });
      }
    }
  }

  // Update donor availability
  const updatedDonor = await prisma.donor.update({
    where: { DonorId: authUser.donor.donorId },
    data: { IsAvailable: isAvailable },
  });

  // Fetch updated user data and generate new token
  const updatedUser = await prisma.user.findUnique({
    where: { UserId: authUser.userId },
    include: {
      donor: true,
      gainer: true,
      organization: true,
    },
  });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found after update' });
  }

  const newToken = generateToken(updatedUser);
  const userData = buildUserPayload(updatedUser);

  return res.status(200).json({
    message: `Donor availability set to ${isAvailable ? 'available' : 'unavailable'} successfully`,
    isAvailable: updatedDonor.IsAvailable,
    donorId: updatedDonor.DonorId,
    token: newToken,
    user: userData,
  });
};

// Get all donors (for Gainers to browse)
export const getAllDonors = async (req: Request, res: Response) => {
  try {
    const donors = await prisma.donor.findMany({
      include: {
        user: {
          select: {
            FullName: true,
            Email: true,
            Phone: true,
            ProfileImage: true,
          }
        }
      }
    });

    const formattedDonors = donors.map(donor => {
      const profileImage = getFullImageUrl(donor.user?.ProfileImage);

      return {
        id: donor.UserId,
        donorId: donor.DonorId,
        name: donor.user.FullName,
        email: donor.user.Email,
        phone: donor.user.Phone,
        profileImage: profileImage,
        bloodType: donor.BloodType,
        location: donor.Location,
        lastDonationDate: donor.LastDonationDate,
        eligibilityStatus: donor.EligibilityStatus,
        isAvailable: donor.IsAvailable,
        role: 'Donor'
      };
    });

    return res.status(200).json({
      message: 'Donors retrieved successfully',
      donors: formattedDonors
    });
  } catch (error: any) {
    console.error('Error fetching donors:', error);
    return res.status(500).json({ message: 'Error fetching donors', error: error.message });
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Fetch accepted donation offers
    const acceptedOffers = await prisma.donationOffer.findMany({
      where: { Status: 'accepted' },
      include: { donor: { include: { user: { select: { FullName: true, UserId: true } } } } }
    });

    // Fetch camp attendances
    const campAttendances = await prisma.campAttendance.findMany({
      include: { user: { select: { FullName: true, UserId: true } } }
    });

    // Aggregate data — track first donation time this month for monthly rank
    const donorStats: Record<string, { userId: string; name: string; monthlyFirstDate: Date | null; yearlyCount: number }> = {};

    const processDonation = (userId: string, name: string, date: Date) => {
      if (!donorStats[userId]) {
        donorStats[userId] = { userId, name, monthlyFirstDate: null, yearlyCount: 0 };
      }

      if (date >= startOfMonth) {
        // Keep the EARLIEST donation this month — first to donate wins
        if (!donorStats[userId].monthlyFirstDate || date < donorStats[userId].monthlyFirstDate!) {
          donorStats[userId].monthlyFirstDate = date;
        }
      }

      if (date >= startOfYear) {
        donorStats[userId].yearlyCount += 1;
      }
    };

    acceptedOffers.forEach(offer => {
      if (offer.donor?.user) {
        processDonation(offer.donor.user.UserId, offer.donor.user.FullName, offer.DonationDate || offer.CreatedAt);
      }
    });

    campAttendances.forEach(attendance => {
      if (attendance.user) {
        processDonation(attendance.user.UserId, attendance.user.FullName, attendance.CreatedAt);
      }
    });

    const statsArray = Object.values(donorStats);

    // Monthly: Ranked by FIRST donation this month — earliest timestamp = rank 1
    const monthlyTop = statsArray
      .filter(s => s.monthlyFirstDate !== null)
      .sort((a, b) => a.monthlyFirstDate!.getTime() - b.monthlyFirstDate!.getTime())
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1, monthlyFirstDate: s.monthlyFirstDate!.toISOString() }));

    // Yearly: Ranked by total donation count this year — highest count = rank 1
    const yearlyTop = statsArray
      .filter(s => s.yearlyCount > 0)
      .sort((a, b) => b.yearlyCount - a.yearlyCount)
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return res.status(200).json({ monthly: monthlyTop, yearly: yearlyTop });

  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
  }
};
