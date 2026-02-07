import express from 'express';
import {
    acceptEmergencyRequest,
    cancelEmergencyRequest,
    createEmergencyRequest,
    stopEmergencyRequest
} from '../controllers/emergencyController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/create', catchAsync(createEmergencyRequest));
router.patch('/accept/:requestId', catchAsync(acceptEmergencyRequest));
router.patch('/cancel/:requestId', catchAsync(cancelEmergencyRequest));
router.patch('/stop/:requestId', catchAsync(stopEmergencyRequest));

export default router;
