import express from 'express';
import { esewaFailure, esewaSuccess, initiateEsewaPayment, initiateKhaltiPayment, khaltiCallback, verifyEsewaPayment, verifyKhaltiPayment } from '../controllers/paymentController.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.post('/initiate-khalti', catchAsync(initiateKhaltiPayment));
router.get('/khalti-callback', catchAsync(khaltiCallback));
router.post('/verify-khalti', catchAsync(verifyKhaltiPayment));

router.post('/initiate-esewa', catchAsync(initiateEsewaPayment));
router.post('/verify-esewa', catchAsync(verifyEsewaPayment));
router.get('/esewa-success', catchAsync(esewaSuccess));
router.get('/esewa-failure', catchAsync(esewaFailure));

export default router;
