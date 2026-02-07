import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';
import { buildUserPayload, generateToken } from './userController.js';

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

    // Check if donor has a LastDonationDate
    if (freshDonor.LastDonationDate) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      if (new Date(freshDonor.LastDonationDate) > threeMonthsAgo) {
        const nextAvailableDate = new Date(freshDonor.LastDonationDate);
        nextAvailableDate.setMonth(nextAvailableDate.getMonth() + 3);

        return res.status(400).json({
          message: 'You cannot set yourself as available yet. You must wait 3 months after your last donation.',
          lastDonationDate: freshDonor.LastDonationDate,
          nextAvailableDate: nextAvailableDate,
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
