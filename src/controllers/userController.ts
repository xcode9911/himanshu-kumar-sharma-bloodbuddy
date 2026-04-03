import axios from "axios";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Prisma } from "../../generated/prisma/client.js";
import prisma from "../models/index.js";
import {
    sendOTPEmail,
    sendPasswordResetOTPEmail,
} from "../utils/emailService.js";

const JWT_SECRET = process.env.JWT_SECRET || "bloodbuddysecret";
const OTP_EXPIRY_MINUTES = 10;
const DEFAULT_ELIGIBILITY_STATUS = "not_eligible";

// Helper function to generate OTP
const generateOTP = (): string => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// Helper function to hash password
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

// Helper function to compare password
const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

const parseCoordinateValue = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

type YesNo = "yes" | "no";
type EligibilityAnswers = {
  q1: YesNo;
  q2: YesNo;
  q3: YesNo;
  q4: YesNo;
  q5: YesNo;
  q6: YesNo;
  q7: YesNo;
  q8: YesNo;
  q9: YesNo;
  q10: YesNo;
  q11: YesNo;
  q12: YesNo;
  q13: YesNo;
  q14: YesNo;
  q15: YesNo;
};

const normalizeYesNo = (value: unknown): YesNo | null => {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "yes" || lower === "y") return "yes";
    if (lower === "no" || lower === "n") return "no";
  }
  return null;
};

const evaluateEligibility = (answers: EligibilityAnswers) => {
  const hardRejects: string[] = [];
  const softFlags: string[] = [];

  const yes = (key: keyof EligibilityAnswers) => answers[key] === "yes";
  const no = (key: keyof EligibilityAnswers) => answers[key] === "no";

  if (yes("q1"))
    hardRejects.push("Recent fever/flu/antibiotics in the past 2 weeks");
  if (yes("q2")) hardRejects.push("Previously advised not to donate");
  if (yes("q3"))
    hardRejects.push(
      "Recent surgery, dental extraction, or invasive procedure",
    );
  if (yes("q4"))
    hardRejects.push("Currently on newly started or adjusted medicines");
  if (yes("q5"))
    hardRejects.push(
      "Recent non-hospital needle exposure (tattoo/piercing/injection/IV)",
    );
  if (yes("q6"))
    hardRejects.push("Recent travel to malaria/dengue/typhoid risk area");
  if (yes("q7"))
    hardRejects.push(
      "Recent illness requiring hospital admission or IV fluids",
    );
  if (yes("q8"))
    hardRejects.push("Recent blood or platelet donation within 3 months");
  if (yes("q10"))
    hardRejects.push("History of dizziness/fainting during or after donation");
  if (yes("q11"))
    hardRejects.push("Unintentional significant weight change recently");
  if (yes("q12")) hardRejects.push("History of positive infection result");
  if (no("q13")) hardRejects.push("Not feeling completely healthy today");
  if (yes("q14")) hardRejects.push("Alcohol consumed in the last 24–48 hours");
  if (yes("q15")) hardRejects.push("Donor feels unsure about donating");

  if (yes("q9")) softFlags.push("Low sleep or skipped major meal");

  const hasHardRejects = hardRejects.length > 0;
  const status: "eligible" | "not_eligible" | "needs_review" = hasHardRejects
    ? "not_eligible"
    : softFlags.length > 0
      ? "needs_review"
      : "eligible";

  return {
    status,
    isEligible: status === "eligible",
    hardRejects,
    softFlags,
  };
};

// Build a safe user payload for JWT (no passwords)
export const buildUserPayload = (user: any) => {
  const base: any = {
    userId: user.UserId,
    email: user.Email,
    fullName: user.FullName,
    role: user.Role,
    phone: user.Phone,
    createdAt: user.CreatedAt,
    profileImage: user.ProfileImage
      ? user.ProfileImage.startsWith("http")
        ? user.ProfileImage
        : `${process.env.API_URL || "http://192.168.1.65:8000"}/${user.ProfileImage}`
      : null,
  };

  if (user.Role === "donor" && user.donor) {
    base.donor = {
      donorId: user.donor.DonorId,
      bloodType: user.donor.BloodType,
      eligibilityStatus: user.donor.EligibilityStatus,
      location: user.donor.Location,
      lastDonationDate: user.donor.LastDonationDate,
      isAvailable: user.donor.IsAvailable,
    };
  } else if (user.Role === "gainer" && user.gainer) {
    base.gainer = {
      gainerId: user.gainer.GainerId,
      address: user.gainer.Address,
    };
  } else if (user.Role === "organization" && user.organization) {
    base.organization = {
      organizationId: user.organization.OrganizationId,
      organizationName: user.organization.OrganizationName,
      location: user.organization.Location,
      contact: user.organization.Contact,
      latitude: user.organization.Latitude,
      longitude: user.organization.Longitude,
      Latitude: user.organization.Latitude,
      Longitude: user.organization.Longitude,
    };
  }

  return base;
};

// Helper function to generate JWT token with full user payload
export const generateToken = (user: any): string => {
  const payload = buildUserPayload(user);
  return jwt.sign({ user: payload }, JWT_SECRET, { expiresIn: "7d" });
};

// Extract userId from bearer token; surface missing/invalid states for proper HTTP errors.
const getUserIdFromAuthHeader = (
  req: Request,
): { userId: string | null; error?: "missing" | "invalid" } => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { userId: null, error: "missing" };
  }

  const [, token] = authHeader.split(" ");
  if (!token) {
    return { userId: null, error: "invalid" };
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { userId: decoded?.user?.userId ?? null };
  } catch (err) {
    return { userId: null, error: "invalid" };
  }
};

// Unified Register Function
export const register = async (req: Request, res: Response) => {
  const { role, fullName, email, password, phone, ...roleSpecificData } =
    req.body;

  // Validate role
  const validRoles = ["donor", "gainer", "organization"];
  if (!role || !validRoles.includes(role.toLowerCase())) {
    return res.status(400).json({
      message: "Invalid role. Must be one of: donor, gainer, organization",
    });
  }

  const userRole = role.toLowerCase();

  // Common required fields validation
  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Missing required fields: fullName, email, password" });
  }

  // Role-specific validation
  let sanitizedRoleData: any = roleSpecificData;

  if (userRole === "donor") {
    const { bloodType, location, lastDonationDate } = roleSpecificData;
    if (!bloodType || !location) {
      return res.status(400).json({
        message: "Missing required fields for donor: bloodType, location",
      });
    }

    sanitizedRoleData = {
      bloodType,
      location,
      eligibilityStatus: DEFAULT_ELIGIBILITY_STATUS,
      ...(lastDonationDate ? { lastDonationDate } : {}),
    };
  } else if (userRole === "organization") {
    const { organizationName, location } = roleSpecificData;
    if (!organizationName || !location) {
      return res.status(400).json({
        message:
          "Missing required fields for organization: organizationName, location",
      });
    }
    const latitude = parseCoordinateValue(
      roleSpecificData.latitude ?? roleSpecificData.Latitude,
    );
    const longitude = parseCoordinateValue(
      roleSpecificData.longitude ?? roleSpecificData.Longitude,
    );

    sanitizedRoleData = {
      organizationName,
      location,
      ...(roleSpecificData.contact
        ? { contact: roleSpecificData.contact }
        : {}),
      ...(latitude !== null ? { latitude } : {}),
      ...(longitude !== null ? { longitude } : {}),
    };
  } else if (userRole === "gainer") {
    sanitizedRoleData = {
      ...(roleSpecificData.address
        ? { address: roleSpecificData.address }
        : {}),
    };
  }
  // Gainer only needs fullName, email, password (address is optional)

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { Email: email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
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
        CreatedAt: "desc",
      },
    });

    if (pendingOtp) {
      return res.status(400).json({
        message:
          "Registration already in progress. Please check your email for OTP or use resend OTP.",
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
      roleSpecificData: sanitizedRoleData,
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
      console.error("Error sending OTP email:", emailError);
      // Delete the OTP record if email fails
      await prisma.otp.deleteMany({
        where: {
          Email: email,
          Code: otpCode,
        },
      });
      return res.status(500).json({
        message: "Failed to send OTP email. Please try again.",
      });
    }

    const roleMessages: Record<string, string> = {
      donor:
        "Registration initiated. Please check your email for the OTP verification code to complete registration.",
      gainer:
        "Registration initiated. Please check your email for the OTP verification code to complete registration.",
      organization:
        "Registration initiated. Please check your email for the OTP verification code to complete registration.",
    };

    return res.status(201).json({
      message: roleMessages[userRole],
      email: email,
    });
  } catch (error: any) {
    console.error(`Error registering ${userRole}:`, error);
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Email already in use" });
    }
    return res.status(500).json({
      message: `Error registering ${userRole}`,
      error: error.message,
    });
  }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
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
          message: "OTP has been resent to your email address.",
        });
      } catch (emailError: any) {
        console.error("Error sending OTP email:", emailError);
        return res.status(500).json({
          message: "Failed to send OTP email. Please try again later.",
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
        CreatedAt: "desc",
      },
    });

    if (!pendingOtp || !pendingOtp.RegistrationData) {
      return res.status(404).json({
        message: "No pending registration found. Please register first.",
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
          message: "OTP has been resent to your email address.",
        });
      } catch (emailError: any) {
        console.error("Error sending OTP email:", emailError);
        return res.status(500).json({
          message: "Failed to send OTP email. Please try again later.",
        });
      }
    }

    // OTP still valid - resend the same code
    try {
      const registrationData = pendingOtp.RegistrationData as any;
      await sendOTPEmail(email, pendingOtp.Code, registrationData.fullName);
      return res.status(200).json({
        message: "OTP has been resent to your email address.",
      });
    } catch (emailError: any) {
      console.error("Error sending OTP email:", emailError);
      return res.status(500).json({
        message: "Failed to send OTP email. Please try again later.",
      });
    }
  } catch (error: any) {
    console.error("Error resending OTP:", error);
    return res
      .status(500)
      .json({ message: "Error resending OTP", error: error.message });
  }
};

// Verify OTP
export const verifyOTP = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "Email and OTP code are required" });
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
        CreatedAt: "desc",
      },
    });

    if (!otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
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
        return res.status(400).json({ message: "User not found" });
      }

      // Mark OTP as used
      await prisma.otp.update({
        where: { OtpId: otp.OtpId },
        data: { IsUsed: true },
      });

      const userPayload = buildUserPayload(user);
      const token = generateToken(user);

      return res.status(200).json({
        message: "OTP verified successfully",
        token,
        user: userPayload,
      });
    }

    // If no user exists, this is a new registration - create user from registration data
    if (!otp.RegistrationData) {
      return res.status(400).json({ message: "Registration data not found" });
    }

    const registrationData = otp.RegistrationData as any;
    const { fullName, password, phone, role, roleSpecificData } =
      registrationData;

    // Create user and role-specific record in a transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
        if (role === "donor") {
          const { bloodType, eligibilityStatus, location, lastDonationDate } =
            roleSpecificData;
          roleSpecificRecord = await tx.donor.create({
            data: {
              UserId: user.UserId,
              BloodType: bloodType,
              EligibilityStatus: eligibilityStatus,
              Location: location,
              LastDonationDate: lastDonationDate
                ? new Date(lastDonationDate)
                : null,
            },
          });
        } else if (role === "gainer") {
          const { address } = roleSpecificData;
          roleSpecificRecord = await tx.gainer.create({
            data: {
              UserId: user.UserId,
              Address: address || null,
            },
          });
        } else if (role === "organization") {
          const { organizationName, location, contact, latitude, longitude } =
            roleSpecificData;
          roleSpecificRecord = await tx.organization.create({
            data: {
              UserId: user.UserId,
              OrganizationName: organizationName,
              Location: location,
              ...(latitude !== undefined
                ? { Latitude: parseCoordinateValue(latitude) }
                : {}),
              ...(longitude !== undefined
                ? { Longitude: parseCoordinateValue(longitude) }
                : {}),
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
      },
    );

    const createdUser = await prisma.user.findUnique({
      where: { UserId: result.user.UserId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (!createdUser) {
      return res
        .status(500)
        .json({ message: "User created but failed to load profile" });
    }

    const userPayload = buildUserPayload(createdUser);
    const token = generateToken(createdUser);

    return res.status(200).json({
      message: "OTP verified successfully. Account created.",
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }
    return res
      .status(500)
      .json({ message: "Error verifying OTP", error: error.message });
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
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
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.Password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const userData = buildUserPayload(user);
    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error: any) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ message: "Error during login", error: error.message });
  }
};

// Request Password Reset (send OTP)
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User with this email does not exist." });
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
      console.error("Error sending password reset OTP email:", emailError);
      // Avoid leaking details, still return generic success
    }

    return res
      .status(200)
      .json({ message: "OTP has been sent to your email." });
  } catch (error: any) {
    console.error("Error requesting password reset:", error);
    return res
      .status(500)
      .json({
        message: "Error requesting password reset",
        error: error.message,
      });
  }
};

// Reset Password using OTP
export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res
      .status(400)
      .json({ message: "Email, OTP code, and newPassword are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        Email: email,
        Code: code,
        IsUsed: false,
        ExpiresAt: { gt: new Date() },
        UserId: user.UserId,
      },
      orderBy: { CreatedAt: "desc" },
    });

    if (!otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const hashed = await hashPassword(newPassword);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return res
      .status(200)
      .json({ message: "Password has been reset successfully" });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return res
      .status(500)
      .json({ message: "Error resetting password", error: error.message });
  }
};

// Update User Profile
export const updateProfile = async (req: Request, res: Response) => {
  const { userId, fullName, phone, password, ...roleSpecificData } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
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
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare user update data
    const userUpdateData: any = {};
    if (fullName) userUpdateData.FullName = fullName;
    if (phone !== undefined) userUpdateData.Phone = phone;
    if (password) {
      userUpdateData.Password = await hashPassword(password);
    }

    // Handle Profile Image Upload
    if (req.file) {
      userUpdateData.ProfileImage = req.file.path.replace(/\\/g, "/");
    }

    // Update in transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Update user table
        const updatedUser = await tx.user.update({
          where: { UserId: userId },
          data: userUpdateData,
        });

        let roleSpecificRecord: any = null;

        // Update role-specific data
        if (existingUser.Role === "donor" && existingUser.donor) {
          const donorUpdateData: any = {};
          if (roleSpecificData.bloodType)
            donorUpdateData.BloodType = roleSpecificData.bloodType;
          if (roleSpecificData.eligibilityStatus)
            donorUpdateData.EligibilityStatus =
              roleSpecificData.eligibilityStatus;
          if (roleSpecificData.location)
            donorUpdateData.Location = roleSpecificData.location;
          if (roleSpecificData.lastDonationDate) {
            donorUpdateData.LastDonationDate = new Date(
              roleSpecificData.lastDonationDate,
            );
          }

          if (Object.keys(donorUpdateData).length > 0) {
            roleSpecificRecord = await tx.donor.update({
              where: { DonorId: existingUser.donor.DonorId },
              data: donorUpdateData,
            });
          }
        } else if (existingUser.Role === "gainer" && existingUser.gainer) {
          const gainerUpdateData: any = {};
          if (roleSpecificData.address !== undefined)
            gainerUpdateData.Address = roleSpecificData.address;

          if (Object.keys(gainerUpdateData).length > 0) {
            roleSpecificRecord = await tx.gainer.update({
              where: { GainerId: existingUser.gainer.GainerId },
              data: gainerUpdateData,
            });
          }
        } else if (
          existingUser.Role === "organization" &&
          existingUser.organization
        ) {
          const orgUpdateData: any = {};
          if (roleSpecificData.organizationName)
            orgUpdateData.OrganizationName = roleSpecificData.organizationName;
          if (roleSpecificData.location)
            orgUpdateData.Location = roleSpecificData.location;
          if (roleSpecificData.contact !== undefined)
            orgUpdateData.Contact = roleSpecificData.contact;

          const latitude = parseCoordinateValue(
            roleSpecificData.latitude ?? roleSpecificData.Latitude,
          );
          const longitude = parseCoordinateValue(
            roleSpecificData.longitude ?? roleSpecificData.Longitude,
          );
          if (latitude !== null) orgUpdateData.Latitude = latitude;
          if (longitude !== null) orgUpdateData.Longitude = longitude;

          if (Object.keys(orgUpdateData).length > 0) {
            roleSpecificRecord = await tx.organization.update({
              where: {
                OrganizationId: existingUser.organization.OrganizationId,
              },
              data: orgUpdateData,
            });
          }
        }

        return { updatedUser, roleSpecificRecord };
      },
    );

    // Fetch complete updated profile
    const updatedProfile = await prisma.user.findUnique({
      where: { UserId: userId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    const userData = buildUserPayload(updatedProfile!);
    const token = generateToken(updatedProfile!);

    return res.status(200).json({
      message: "Profile updated successfully",
      user: userData,
      token,
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return res
      .status(500)
      .json({ message: "Error updating profile", error: error.message });
  }
};

export const checkEligibility = async (req: Request, res: Response) => {
  const { userId, answers } = req.body;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  if (authError === "missing") {
    return res
      .status(401)
      .json({ message: "Authorization bearer token is required" });
  }

  if (authError === "invalid") {
    return res
      .status(401)
      .json({ message: "Invalid or expired authorization token" });
  }

  const effectiveUserId = authUserId ?? userId;

  const requiredKeys: Array<keyof EligibilityAnswers> = [
    "q1",
    "q2",
    "q3",
    "q4",
    "q5",
    "q6",
    "q7",
    "q8",
    "q9",
    "q10",
    "q11",
    "q12",
    "q13",
    "q14",
    "q15",
  ];

  if (!answers || typeof answers !== "object") {
    return res
      .status(400)
      .json({ message: "answers object with q1–q15 is required" });
  }

  const normalizedAnswers = {} as EligibilityAnswers;

  for (const key of requiredKeys) {
    const normalized = normalizeYesNo(
      (answers as Record<string, unknown>)[key],
    );
    if (!normalized) {
      return res
        .status(400)
        .json({
          message: `Invalid answer for ${key}. Use yes/no or true/false.`,
        });
    }
    normalizedAnswers[key] = normalized;
  }

  const evaluation = evaluateEligibility(normalizedAnswers);

  let storedEligibilityStatus: string | null = null;
  let token: string | null = null;
  let userData: any = null;

  if (effectiveUserId) {
    const user = await prisma.user.findUnique({
      where: { UserId: effectiveUserId },
      include: { donor: true },
    });

    if (!user || user.Role.toLowerCase() !== "donor" || !user.donor) {
      return res
        .status(400)
        .json({
          message: "Eligibility can only be stored for a valid donor user.",
        });
    }

    // Enforce 56-day cooldown regardless of questionnaire answers
    let finalStatus = evaluation.status;
    if (user.donor.LastDonationDate) {
      const cooldownMs = 56 * 24 * 60 * 60 * 1000;
      const lastDonation = new Date(user.donor.LastDonationDate).getTime();
      const now = Date.now();
      if (now - lastDonation < cooldownMs) {
        finalStatus = "not_eligible";
        const daysRemaining = Math.ceil(
          (lastDonation + cooldownMs - now) / (24 * 60 * 60 * 1000),
        );
        evaluation.hardRejects.push(
          `Must wait ${daysRemaining} more days since last donation (56-day cooldown).`,
        );
        evaluation.isEligible = false;
      }
    }

    const updatedDonor = await prisma.donor.update({
      where: { DonorId: user.donor.DonorId },
      data: { EligibilityStatus: finalStatus },
    });

    storedEligibilityStatus = updatedDonor.EligibilityStatus;

    // Fetch updated user with new eligibility status
    const updatedUser = await prisma.user.findUnique({
      where: { UserId: effectiveUserId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (updatedUser) {
      // Generate new JWT token with updated eligibility status
      token = generateToken(updatedUser);
      userData = buildUserPayload(updatedUser);
    }
  }

  return res.status(200).json({
    status: evaluation.status,
    isEligible: evaluation.isEligible,
    disqualifiers: evaluation.hardRejects,
    softFlags: evaluation.softFlags,
    ...(storedEligibilityStatus ? { storedEligibilityStatus } : {}),
    ...(token ? { token } : {}),
    ...(userData ? { user: userData } : {}),
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  if (authError === "missing") {
    return res
      .status(401)
      .json({ message: "Authorization bearer token is required" });
  }

  if (authError === "invalid") {
    return res
      .status(401)
      .json({ message: "Invalid or expired authorization token" });
  }

  if (!authUserId) {
    return res.status(401).json({ message: "User ID not found in token" });
  }

  // Fetch fresh user data from database
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: {
      donor: true,
      gainer: true,
      organization: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Generate new token with fresh data
  const newToken = generateToken(user);
  const userData = buildUserPayload(user);

  return res.status(200).json({
    message: "Token refreshed successfully",
    token: newToken,
    user: userData,
  });
};

/**
 * Get any user's profile by ID (safe fields only)
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { UserId: userId },
      include: {
        donor: true,
        gainer: true,
        organization: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build safe payload using existing helper
    const userData = buildUserPayload(user);

    return res.status(200).json({
      message: "Profile retrieved successfully",
      user: userData,
    });
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    return res
      .status(500)
      .json({ message: "Error fetching user profile", error: error.message });
  }
};

// Instagram OAuth Authentication
export const authenticateInstagram = async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: "Authorization code is required" });
  }

  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Instagram OAuth environment variables are missing");
    return res
      .status(500)
      .json({ message: "Instagram login is not configured on the server" });
  }

  try {
    // 1. Exchange authorization code for a short-lived access token
    const tokenResponse = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, user_id } = tokenResponse.data;

    // 2. Fetch user profile data (username)
    const profileResponse = await axios.get(
      `https://graph.instagram.com/me?fields=id,username&access_token=${access_token}`,
    );

    const { username } = profileResponse.data;

    return res.status(200).json({
      message: "Instagram authentication successful",
      username: username,
    });
  } catch (error: any) {
    console.error(
      "Error during Instagram authentication:",
      error.response?.data || error.message,
    );
    return res.status(500).json({
      message: "Failed to authenticate with Instagram",
      error: error.response?.data?.error_message || error.message,
    });
  }
};
