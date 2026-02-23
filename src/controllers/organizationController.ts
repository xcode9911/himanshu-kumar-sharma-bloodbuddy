import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

// Extract userId from bearer token
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

// Valid blood types
const VALID_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Add or update blood inventory
export const addOrUpdateInventory = async (req: Request, res: Response) => {
  const { bloodType, units } = req.body;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUserId) {
    return res.status(401).json({ message: 'User ID not found in token' });
  }

  // Validate input
  if (!bloodType || typeof bloodType !== 'string') {
    return res.status(400).json({ message: 'Blood type is required and must be a string' });
  }

  if (!VALID_BLOOD_TYPES.includes(bloodType)) {
    return res.status(400).json({
      message: `Invalid blood type. Must be one of: ${VALID_BLOOD_TYPES.join(', ')}`
    });
  }

  if (typeof units !== 'number' || units < 0) {
    return res.status(400).json({ message: 'Units must be a non-negative number' });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.Role.toLowerCase() !== 'organization' || !user.organization) {
    return res.status(400).json({ message: 'Only organizations can manage inventory' });
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
  } else {
    // Create new inventory entry
    inventory = await prisma.inventory.create({
      data: {
        OrganizationId: organizationId,
        BloodType: bloodType,
        Units: units,
      },
    });
  }

  return res.status(200).json({
    message: existingInventory
      ? `Inventory updated successfully. Added ${units} units. Total: ${inventory.Units}`
      : 'Inventory added successfully',
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
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUserId) {
    return res.status(401).json({ message: 'User ID not found in token' });
  }

  if (!bloodType) {
    return res.status(400).json({ message: 'Blood type parameter is required' });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.Role.toLowerCase() !== 'organization' || !user.organization) {
    return res.status(400).json({ message: 'Only organizations can check inventory' });
  }

  const organizationId = user.organization.OrganizationId;

  // Check if inventory entry exists
  const existingInventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodType,
    },
  });

  return res.status(200).json({
    exists: !!existingInventory,
    bloodType: bloodType,
    currentUnits: existingInventory?.Units || 0,
  });
};

// Get all inventory for the organization
export const getInventory = async (req: Request, res: Response) => {
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUserId) {
    return res.status(401).json({ message: 'User ID not found in token' });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.Role.toLowerCase() !== 'organization' || !user.organization) {
    return res.status(400).json({ message: 'Only organizations can view inventory' });
  }

  const organizationId = user.organization.OrganizationId;

  // Fetch all inventory for this organization
  const inventory = await prisma.inventory.findMany({
    where: { OrganizationId: organizationId },
    orderBy: { BloodType: 'asc' },
  });

  return res.status(200).json({
    organizationId,
    organizationName: user.organization.OrganizationName,
    inventory: inventory.map(item => ({
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
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUserId) {
    return res.status(401).json({ message: 'User ID not found in token' });
  }

  if (!bloodType) {
    return res.status(400).json({ message: 'Blood type parameter is required' });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.Role.toLowerCase() !== 'organization' || !user.organization) {
    return res.status(400).json({ message: 'Only organizations can manage inventory' });
  }

  const organizationId = user.organization.OrganizationId;

  // Find and delete the inventory entry
  const inventory = await prisma.inventory.findFirst({
    where: {
      OrganizationId: organizationId,
      BloodType: bloodType,
    },
  });

  if (!inventory) {
    return res.status(404).json({
      message: `No inventory found for blood type ${bloodType}`
    });
  }

  await prisma.inventory.delete({
    where: { InventoryId: inventory.InventoryId },
  });

  return res.status(200).json({
    message: `Inventory for blood type ${bloodType} deleted successfully`,
  });
};

// Update inventory units (set specific value)
export const updateInventoryUnits = async (req: Request, res: Response) => {
  const { bloodType, units } = req.body;
  const { userId: authUserId, error: authError } = getUserIdFromAuthHeader(req);

  // Check authentication
  if (authError === 'missing') {
    return res.status(401).json({ message: 'Authorization bearer token is required' });
  }

  if (authError === 'invalid') {
    return res.status(401).json({ message: 'Invalid or expired authorization token' });
  }

  if (!authUserId) {
    return res.status(401).json({ message: 'User ID not found in token' });
  }

  // Validate input
  if (!bloodType || typeof bloodType !== 'string') {
    return res.status(400).json({ message: 'Blood type is required and must be a string' });
  }

  if (!VALID_BLOOD_TYPES.includes(bloodType)) {
    return res.status(400).json({
      message: `Invalid blood type. Must be one of: ${VALID_BLOOD_TYPES.join(', ')}`
    });
  }

  if (typeof units !== 'number' || units < 0) {
    return res.status(400).json({ message: 'Units must be a non-negative number' });
  }

  // Fetch user and organization information
  const user = await prisma.user.findUnique({
    where: { UserId: authUserId },
    include: { organization: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.Role.toLowerCase() !== 'organization' || !user.organization) {
    return res.status(400).json({ message: 'Only organizations can manage inventory' });
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
      message: `No inventory found for blood type ${bloodType}. Please add it first.`
    });
  }

  // Update inventory with new units value
  const updatedInventory = await prisma.inventory.update({
    where: { InventoryId: existingInventory.InventoryId },
    data: { Units: units },
  });

  return res.status(200).json({
    message: 'Inventory units updated successfully',
    inventory: {
      inventoryId: updatedInventory.InventoryId,
      organizationId: updatedInventory.OrganizationId,
      bloodType: updatedInventory.BloodType,
      units: updatedInventory.Units,
    },
  });
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
            Phone: true
          }
        }
      }
    });

    const formattedOrgs = organizations.map(org => ({
      id: org.UserId,
      organizationId: org.OrganizationId,
      organizationName: org.OrganizationName,
      location: org.Location,
      contact: org.Contact,
      email: org.user?.Email,
      phone: org.user?.Phone,
      inventory: org.inventory.map(inv => ({
        bloodType: inv.BloodType,
        units: inv.Units
      }))
    }));

    return res.status(200).json({
      message: 'Organizations retrieved successfully',
      organizations: formattedOrgs
    });
  } catch (error: any) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({ message: 'Error fetching organizations', error: error.message });
  }
};
