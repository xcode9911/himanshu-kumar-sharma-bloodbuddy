import express from 'express';
import {
    acceptEmergencyRequest,
    cancelEmergencyRequest,
    createEmergencyRequest,
    getLocation,
    stopEmergencyRequest,
    updateLocation
} from '../controllers/emergencyController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/create', catchAsync(createEmergencyRequest));
router.patch('/accept/:requestId', catchAsync(acceptEmergencyRequest));
router.patch('/cancel/:requestId', catchAsync(cancelEmergencyRequest));
router.patch('/stop/:requestId', catchAsync(stopEmergencyRequest));
router.patch('/location/:requestId', catchAsync(updateLocation));
router.get('/location/:requestId', catchAsync(getLocation));

export default router;
