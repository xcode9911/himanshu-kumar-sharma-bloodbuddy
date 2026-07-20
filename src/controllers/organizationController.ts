import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../models/index.js";
import { logInventoryChange } from "../utils/inventoryLogger.js";
import { getFullImageUrl } from "../utils/imageUtils.js";

const JWT_SECRET = process.env.JWT_SECRET || "bloodbuddysecret";

// Extract userId from bearer token
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

// Valid blood types
const VALID_BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Add or update blood inventory
export const addOrUpdateInventory = async (req: Request, res: Response) => {
  const { bloodType, units } = req.body;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
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

  // Validate input
  if (!bloodType || typeof bloodType !== "string") {
    return res
      .status(400)
      .json({ message: "Blood type is required and must be a string" });
  }

  if (!VALID_BLOOD_TYPES.includes(bloodType)) {
    return res.status(400).json({
      message: `Invalid blood type. Must be one of: ${VALID_BLOOD_TYPES.join(", ")}`,
    });
  }

  if (typeof units !== "number" || units < 0) {
    return res
      .status(400)
      .json({ message: "Units must be a non-negative number" });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.Role.toLowerCase() !== "organization" || !user.organization) {
    return res
      .status(400)
      .json({ message: "Only organizations can manage inventory" });
  }

  const organizationId = user.organization.OrganizationId;

  // Check if inventory entry already exists for this blood type
  const existingInventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodType,
    },
  });

  let inventory;

  if (existingInventory) {
    // Add to existing inventory units instead of replacing
    const newUnits = existingInventory.Units + units;
    inventory = await prisma.inventory.update({
      where: { InventoryId: existingInventory.InventoryId },
      data: { Units: newUnits },
    });

    await logInventoryChange(
      organizationId,
      bloodType,
      units,
      "Add",
      existingInventory.Units,
      newUnits,
    );
  } else {
    // Create new inventory entry
    inventory = await prisma.inventory.create({
      data: {
        OrganizationId: organizationId,
        BloodType: bloodType,
        Units: units,
      },
    });

    await logInventoryChange(organizationId, bloodType, units, "Add", 0, units);
  }

  // Emit real-time inventory update via socket.io
  const io = req.app.get('socketio');
  if (io) {
    io.emit('inventoryUpdated', {
      organizationId,
      bloodType: inventory.BloodType,
      newUnits: inventory.Units,
      action: existingInventory ? 'Add' : 'Add',
    });
  }

  return res.status(200).json({
    message: existingInventory
      ? `Inventory updated successfully. Added ${units} units. Total: ${inventory.Units}`
      : "Inventory added successfully",
    isUpdate: !!existingInventory,
    inventory: {
      inventoryId: inventory.InventoryId,
      organizationId: inventory.OrganizationId,
      bloodType: inventory.BloodType,
      units: inventory.Units,
      addedUnits: units,
    },
  });
};

// Check if blood type exists in inventory (for frontend confirmation)
export const checkBloodTypeExists = async (req: Request, res: Response) => {
  const { bloodType } = req.params;
  const bloodTypeParam = Array.isArray(bloodType) ? bloodType[0] : bloodType;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
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

  if (!bloodTypeParam) {
    return res
      .status(400)
      .json({ message: "Blood type parameter is required" });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.Role.toLowerCase() !== "organization" || !user.organization) {
    return res
      .status(400)
      .json({ message: "Only organizations can check inventory" });
  }

  const organizationId = user.organization.OrganizationId;

  // Check if inventory entry exists
  const existingInventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodTypeParam,
    },
  });

  return res.status(200).json({
    exists: !!existingInventory,
    bloodType: bloodTypeParam,
    currentUnits: existingInventory?.Units || 0,
  });
};

// Get all inventory for the organization
export const getInventory = async (req: Request, res: Response) => {
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
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

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.Role.toLowerCase() !== "organization" || !user.organization) {
    return res
      .status(400)
      .json({ message: "Only organizations can view inventory" });
  }

  const organizationId = user.organization.OrganizationId;

  // Fetch all inventory for this organization
  const inventory = await prisma.inventory.findMany({
    where: { OrganizationId: organizationId },
    orderBy: { BloodType: "asc" },
  });

  return res.status(200).json({
    organizationId,
    organizationName: user.organization.OrganizationName,
    inventory: inventory.map((item) => ({
      inventoryId: item.InventoryId,
      bloodType: item.BloodType,
      units: item.Units,
    })),
    totalBloodTypes: inventory.length,
  });
};

// Delete inventory entry
export const deleteInventory = async (req: Request, res: Response) => {
  const { bloodType } = req.params;
  const bloodTypeParam = Array.isArray(bloodType) ? bloodType[0] : bloodType;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
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

  if (!bloodTypeParam) {
    return res
      .status(400)
      .json({ message: "Blood type parameter is required" });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.Role.toLowerCase() !== "organization" || !user.organization) {
    return res
      .status(400)
      .json({ message: "Only organizations can manage inventory" });
  }

  const organizationId = user.organization.OrganizationId;

  // Find and delete the inventory entry
  const inventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodTypeParam,
    },
  });

  if (!inventory) {
    return res.status(404).json({
      message: `No inventory found for blood type ${bloodTypeParam}`,
    });
  }

  await prisma.inventory.delete({
    where: { InventoryId: inventory.InventoryId },
  });

  await logInventoryChange(
    organizationId,
    bloodTypeParam,
    -inventory.Units,
    "Remove",
    inventory.Units,
    0,
  );

  // Emit real-time inventory update via socket.io
  const ioDelete = req.app.get('socketio');
  if (ioDelete) {
    ioDelete.emit('inventoryUpdated', {
      organizationId,
      bloodType: bloodTypeParam,
      newUnits: 0,
      action: 'Remove',
    });
  }

  return res.status(200).json({
    message: `Inventory for blood type ${bloodTypeParam} deleted successfully`,
  });
};

// Update inventory units (set specific value)
export const updateInventoryUnits = async (req: Request, res: Response) => {
  const { bloodType, units } = req.body;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
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

  // Validate input
  if (!bloodType || typeof bloodType !== "string") {
    return res
      .status(400)
      .json({ message: "Blood type is required and must be a string" });
  }

  if (!VALID_BLOOD_TYPES.includes(bloodType)) {
    return res.status(400).json({
      message: `Invalid blood type. Must be one of: ${VALID_BLOOD_TYPES.join(", ")}`,
    });
  }

  if (typeof units !== "number" || units < 0) {
    return res
      .status(400)
      .json({ message: "Units must be a non-negative number" });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.Role.toLowerCase() !== "organization" || !user.organization) {
    return res
      .status(400)
      .json({ message: "Only organizations can manage inventory" });
  }

  const organizationId = user.organization.OrganizationId;

  // Find existing inventory
  const existingInventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodType,
    },
  });

  if (!existingInventory) {
    return res.status(404).json({
      message: `No inventory found for blood type ${bloodType}. Please add it first.`,
    });
  }

  // Update inventory with new units value
  const updatedInventory = await prisma.inventory.update({
    where: { InventoryId: existingInventory.InventoryId },
    data: { Units: units },
  });

  await logInventoryChange(
    organizationId,
    bloodType,
    units - existingInventory.Units,
    "Update",
    existingInventory.Units,
    units,
  );

  // Emit real-time inventory update via socket.io
  const ioUpdate = req.app.get('socketio');
  if (ioUpdate) {
    ioUpdate.emit('inventoryUpdated', {
      organizationId,
      bloodType: updatedInventory.BloodType,
      newUnits: updatedInventory.Units,
      action: 'Update',
    });
  }

  return res.status(200).json({
    message: "Inventory units updated successfully",
    inventory: {
      inventoryId: updatedInventory.InventoryId,
      organizationId: updatedInventory.OrganizationId,
      bloodType: updatedInventory.BloodType,
      units: updatedInventory.Units,
    },
  });
};

// Get inventory history for the organization
export const getInventoryHistory = async (req: Request, res: Response) => {
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

  try {
    const user = await prisma.user.findUnique({
      where: { UserId: authUserId },
      include: { organization: true },
    });

    if (
      !user ||
      user.Role.toLowerCase() !== "organization" ||
      !user.organization
    ) {
      return res
        .status(403)
        .json({ message: "Only organizations can view history" });
    }

    const history = await prisma.inventoryHistory.findMany({
      where: { OrganizationId: user.organization.OrganizationId },
      orderBy: { CreatedAt: "desc" },
    });

    return res.status(200).json({
      message: "Inventory history retrieved successfully",
      history: history.map((item) => ({
        historyId: item.HistoryId,
        bloodType: item.BloodType,
        unitsChanged: item.UnitsChanged,
        actionType: item.ActionType,
        previousTotal: item.PreviousTotal,
        newTotal: item.NewTotal,
        createdAt: item.CreatedAt,
        referenceId: item.ReferenceId,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching inventory history:", error);
    return res
      .status(500)
      .json({
        message: "Error fetching inventory history",
        error: error.message,
      });
  }
};

// Get all organizations (for Gainers to browse)
export const getAllOrganizations = async (req: Request, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        inventory: true,
        user: {
          select: {
            Email: true,
            Phone: true,
            ProfileImage: true,
          },
        },
      },
    });

    const formattedOrgs = organizations.map((org) => {
      const profileImage = getFullImageUrl(org.user?.ProfileImage);

      return {
        id: org.UserId,
        organizationId: org.OrganizationId,
        organizationName: org.OrganizationName,
        location: org.Location,
        latitude: org.Latitude,
        longitude: org.Longitude,
        Latitude: org.Latitude,
        Longitude: org.Longitude,
        contact: org.Contact,
        email: org.user?.Email,
        phone: org.user?.Phone,
        profileImage: profileImage,
        inventory: org.inventory.map((inv) => ({
          bloodType: inv.BloodType,
          units: inv.Units,
        })),
      };
    });

    return res.status(200).json({
      message: "Organizations retrieved successfully",
      organizations: formattedOrgs,
    });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return res
      .status(500)
      .json({ message: "Error fetching organizations", error: error.message });
  }
};
