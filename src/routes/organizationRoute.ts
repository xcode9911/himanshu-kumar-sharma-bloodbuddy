import express from 'express';
import {
  addOrUpdateInventory,
  getInventory,
  deleteInventory,
  updateInventoryUnits,
  checkBloodTypeExists,
  getAllOrganizations,
  getInventoryHistory,
} from '../controllers/organizationController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// Get all organizations (Public/Gainer)
router.get('/getOrganizations', catchAsync(getAllOrganizations));

// Inventory management routes
router.post('/add-inventory', catchAsync(addOrUpdateInventory));
router.get('/get-inventory', catchAsync(getInventory));
router.get('/check-blood-type/:bloodType', catchAsync(checkBloodTypeExists));
router.delete('/delete-inventory/:bloodType', catchAsync(deleteInventory));
router.patch('/update-inventory-units', catchAsync(updateInventoryUnits));
router.get('/get-inventory-history', catchAsync(getInventoryHistory));

export default router;
