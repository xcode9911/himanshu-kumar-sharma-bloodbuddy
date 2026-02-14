import axios from 'axios';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bloodbuddysecret';

export const initiateKhaltiPayment = async (req: Request, res: Response) => {
    const { requestId, amount, productName } = req.body;
    const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;

    if (!requestId || !amount || !productName) {
        return res.status(400).json({ message: "Missing required fields: requestId, amount, productName" });
    }

    try {
        // Generate unique purchase_order_id
        const purchase_order_id = `ORDER_${requestId}_${Date.now()}`;

        const host = req.get('host') || '192.168.1.67:8000';
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;

        // Initiate payment with Khalti E-Payment API (Sandbox/Test Environment)
        const khaltiResponse = await axios.post(
            'https://a.khalti.com/api/v2/epayment/initiate/',
            {
                return_url: `${baseUrl}/api/payments/khalti-callback`,
                website_url: 'http://localhost:8081',
                amount: amount * 100, // Convert to paisa
                purchase_order_id: purchase_order_id,
                purchase_order_name: productName,
                customer_info: {
                    name: 'Bloodbuddy App',
                    email: 'blood.officialybuddy@gmail.com',
                    phone: '9800000000'
                }
            },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Don't store in database yet - will be created during verification
        // when we have the actual booking details

        return res.status(200).json({
            success: true,
            payment_url: khaltiResponse.data.payment_url,
            pidx: khaltiResponse.data.pidx,
            expires_at: khaltiResponse.data.expires_at
        });

    } catch (error: any) {
        console.error("Payment Initiation Error:");
        console.error("Status:", error.response?.status);
        console.error("Data:", JSON.stringify(error.response?.data, null, 2));
        console.error("Message:", error.message);
        return res.status(500).json({
            message: "Failed to initiate payment",
            error: error.response?.data || error.message,
            details: {
                status: error.response?.status,
                data: error.response?.data
            }
        });
    }
};

export const khaltiCallback = async (req: Request, res: Response) => {
    const { pidx, txnId, amount, mobile, purchase_order_id, purchase_order_name, transaction_id } = req.query;

    // Redirect to a simple success page with pidx as query param
    res.send(`
        <html>
            <head>
                <title>Payment Processing</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        text-align: center;
                        max-width: 400px;
                    }
                    h1 { color: #5C2D91; margin-bottom: 20px; }
                    p { color: #666; margin-bottom: 10px; }
                    .pidx { 
                        background: #f0f0f0; 
                        padding: 10px; 
                        border-radius: 5px; 
                        font-family: monospace;
                        word-break: break-all;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✓ Payment Successful!</h1>
                    <p>Your payment has been processed.</p>
                    <p>Transaction ID:</p>
                    <div class="pidx">${pidx || 'N/A'}</div>
                    <p style="margin-top: 20px; color: #999;">You can close this window and return to the app.</p>
                </div>
            </body>
        </html>
    `);
};

export const verifyKhaltiPayment = async (req: Request, res: Response) => {
    const { pidx, requestId } = req.body;
    const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;

    if (!pidx || !requestId) {
        return res.status(400).json({ message: "Missing required fields: pidx, requestId" });
    }

    try {
        // 1. Lookup payment status with Khalti using pidx
        const khaltiResponse = await axios.post(
            'https://a.khalti.com/api/v2/epayment/lookup/',
            { pidx },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const paymentData = khaltiResponse.data;

        if (paymentData.status === 'Completed') {
            const verifiedAmount = paymentData.total_amount; // in paisa
            const transactionId = paymentData.transaction_id;

            // 2. Update Database via Transaction
            const result = await prisma.$transaction(async (tx) => {
                // Check if payment already exists for this pidx (Idempotency)
                const existingPayment = await tx.payment.findFirst({
                    where: { Token: pidx }
                });

                if (existingPayment) {
                    throw new Error("Payment already processed for this transaction.");
                }

                // Get the Booking to link GainerId
                const booking = await tx.bloodRequest.findUnique({
                    where: { RequestId: requestId },
                    include: { gainer: true }
                });

                if (!booking) {
                    throw new Error("Booking request not found.");
                }

                // Update Blood Request Status
                const updatedRequest = await tx.bloodRequest.update({
                    where: { RequestId: requestId },
                    data: {
                        Status: 'Paid',
                        PaymentStatus: 'Paid'
                    }
                });

                // Create Payment Record
                const newPayment = await tx.payment.create({
                    data: {
                        RequestId: requestId,
                        GainerId: booking.GainerId,
                        Amount: verifiedAmount / 100, // Convert paisa to NPR
                        Status: 'Paid',
                        Provider: 'Khalti',
                        Token: pidx,
                        TransactionId: transactionId
                    }
                });

                return { updatedRequest, newPayment, booking };
            });

            // 3. Send Notifications (Socket.io)
            const io = req.app.get('socketio');
            if (io) {
                // Notify Gainer
                const gainerUserId = result.booking.gainer.UserId;
                io.to(gainerUserId).emit('paymentSuccess', {
                    requestId: result.updatedRequest.RequestId,
                    status: 'Paid'
                });

                // Notify Organization
                const org = await prisma.organization.findUnique({
                    where: { OrganizationId: result.booking.OrganizationId },
                    select: { UserId: true }
                });

                if (org) {
                    io.to(org.UserId).emit('paymentReceived', {
                        requestId: result.updatedRequest.RequestId,
                        amount: result.newPayment.Amount,
                        gainerId: result.booking.GainerId
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: "Payment verified and booking confirmed.",
                payment: result.newPayment
            });

        } else {
            return res.status(400).json({
                message: "Payment not completed",
                status: paymentData.status,
                details: paymentData
            });
        }
    } catch (error: any) {
        console.error("Payment Verification Error:", error.response?.data || error.message);
        return res.status(500).json({
            message: "Internal Server Error during payment verification",
            error: error.message
        });
    }
};

export const initiateEsewaPayment = async (req: Request, res: Response) => {
    const { requestId, amount } = req.body;
    const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
    const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';

    if (!requestId || !amount) {
        return res.status(400).json({ message: "Missing required fields: requestId, amount" });
    }

    try {
        const transaction_uuid = `ESEWA_${requestId}_${Date.now()}`;

        // Prepare signature string: total_amount=100,transaction_uuid=abcd,product_code=EPAYTEST
        // Note: amount must be exact string as sent to eSewa
        const signatureString = `total_amount=${amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_MERCHANT_CODE}`;

        const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
        hmac.update(signatureString);
        const signature = hmac.digest('base64');

        const host = req.get('host') || '192.168.1.67:8000';
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;

        return res.status(200).json({
            success: true,
            initiation_data: {
                amount: amount,
                tax_amount: "0",
                total_amount: amount,
                transaction_uuid: transaction_uuid,
                product_code: ESEWA_MERCHANT_CODE,
                product_service_charge: "0",
                product_delivery_charge: "0",
                success_url: `${baseUrl}/api/payments/esewa-success`,
                failure_url: `${baseUrl}/api/payments/esewa-failure`,
                signed_field_names: "total_amount,transaction_uuid,product_code",
                signature: signature
            }
        });

    } catch (error: any) {
        console.error("eSewa Initiation Error:", error);
        return res.status(500).json({
            message: "Failed to initiate eSewa payment",
            error: error.message
        });
    }
};

export const verifyEsewaPayment = async (req: Request, res: Response) => {
    const { encoded_data, requestId } = req.body;
    const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';

    if (!encoded_data || !requestId) {
        return res.status(400).json({ message: "Missing required fields: encoded_data, requestId" });
    }

    try {
        // 1. Decode the base64 encoded data from eSewa
        const decodedString = Buffer.from(encoded_data, 'base64').toString();
        const decodedData = JSON.parse(decodedString);

        console.log("Decoded eSewa Data:", decodedData);

        // 2. Verify with eSewa Transaction Status API
        const esewaResponse = await axios.get(
            `https://rc.esewa.com.np/api/epay/transaction/status/`,
            {
                params: {
                    product_code: ESEWA_MERCHANT_CODE,
                    total_amount: decodedData.total_amount,
                    transaction_uuid: decodedData.transaction_uuid
                }
            }
        );

        if (esewaResponse.data.status === 'COMPLETE') {
            const verifiedAmount = parseFloat(esewaResponse.data.total_amount);
            const transactionId = esewaResponse.data.transaction_code;

            // 3. Update Database via Transaction
            const result = await prisma.$transaction(async (tx) => {
                // Idempotency check
                const existingPayment = await tx.payment.findFirst({
                    where: { Token: decodedData.transaction_uuid }
                });

                if (existingPayment) {
                    throw new Error("Payment already processed.");
                }

                const booking = await tx.bloodRequest.findUnique({
                    where: { RequestId: requestId },
                    include: { gainer: true }
                });

                if (!booking) {
                    throw new Error("Booking request not found.");
                }

                // Update Request Status
                await tx.bloodRequest.update({
                    where: { RequestId: requestId },
                    data: {
                        Status: 'Paid',
                        PaymentStatus: 'Paid'
                    }
                });

                // Create Payment Record
                const newPayment = await tx.payment.create({
                    data: {
                        RequestId: requestId,
                        GainerId: booking.GainerId,
                        Amount: verifiedAmount,
                        Status: 'Paid',
                        Provider: 'eSewa',
                        Token: decodedData.transaction_uuid,
                        TransactionId: transactionId
                    }
                });

                return { newPayment, booking };
            });

            // 4. Send Notifications
            const io = req.app.get('socketio');
            if (io) {
                const gainerUserId = result.booking.gainer.UserId;
                io.to(gainerUserId).emit('paymentSuccess', {
                    requestId: requestId,
                    status: 'Paid',
                    provider: 'eSewa'
                });

                const org = await prisma.organization.findUnique({
                    where: { OrganizationId: result.booking.OrganizationId },
                    select: { UserId: true }
                });

                if (org) {
                    io.to(org.UserId).emit('paymentReceived', {
                        requestId: requestId,
                        amount: result.newPayment.Amount,
                        gainerId: result.booking.GainerId
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: "eSewa payment verified successfully.",
                payment: result.newPayment
            });
        } else {
            return res.status(400).json({
                message: "eSewa payment verification failed or incomplete",
                status: esewaResponse.data.status
            });
        }

    } catch (error: any) {
        console.error("eSewa Verification Error:", error.message);
        return res.status(500).json({
            message: "Internal Server Error during eSewa verification",
            error: error.message
        });
    }
};

export const esewaSuccess = async (req: Request, res: Response) => {
    res.send(`
        <html>
            <head>
                <title>eSewa Payment Successful</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4f4f4; }
                    .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
                    h1 { color: #60bb46; margin-bottom: 15px; }
                    p { color: #666; font-size: 16px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✓ Payment Received</h1>
                    <p>Redirecting you back to the app...</p>
                </div>
            </body>
        </html>
    `);
};

export const esewaFailure = async (req: Request, res: Response) => {
    res.send(`
        <html>
            <head>
                <title>eSewa Payment Failed</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fff5f5; }
                    .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
                    h1 { color: #e53e3e; margin-bottom: 15px; }
                    p { color: #666; font-size: 16px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✕ Payment Failed</h1>
                    <p>There was an issue processing your payment.</p>
                </div>
            </body>
        </html>
    `);
};

export const getPaymentHistory = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
            return res.status(401).json({ message: "Unauthorized: Missing or invalid token" });
        }

        const parts = authHeader.split(' ');
        if (parts.length < 2) {
            return res.status(401).json({ message: "Unauthorized: Invalid token format" });
        }
        const token = parts[1] as string;
        let userId: string = '';
        let role: string = '';

        try {
            const decoded: any = jwt.verify(token, JWT_SECRET as string);
            userId = decoded?.user?.userId as string;
            role = decoded?.user?.role?.toLowerCase() as string;
        } catch (err) {
            return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }

        if (!userId || !role) {
            return res.status(401).json({ message: "Unauthorized: User info not found in token" });
        }

        let payments;

        if (role === 'gainer') {
            const gainer = await prisma.gainer.findUnique({
                where: { UserId: userId }
            });

            if (!gainer) {
                return res.status(404).json({ message: "Gainer record not found" });
            }

            payments = await prisma.payment.findMany({
                where: { GainerId: gainer.GainerId },
                include: {
                    request: {
                        include: {
                            organization: {
                                select: {
                                    OrganizationName: true,
                                    Location: true
                                }
                            }
                        }
                    }
                },
                orderBy: { PaymentDate: 'desc' }
            });
        } else if (role === 'organization') {
            const org = await prisma.organization.findUnique({
                where: { UserId: userId }
            });

            if (!org) {
                return res.status(404).json({ message: "Organization record not found" });
            }

            payments = await prisma.payment.findMany({
                where: {
                    request: {
                        OrganizationId: org.OrganizationId
                    }
                },
                include: {
                    gainer: {
                        include: {
                            user: {
                                select: {
                                    FullName: true,
                                    Phone: true
                                }
                            }
                        }
                    },
                    request: true
                },
                orderBy: { PaymentDate: 'desc' }
            });
        } else {
            // For donors or other roles, if they ever have payments linked directly or via GainerId
            // The prompt asked for Donor side to see their payments too (if they are also gainers or if payments exist for them)
            // But usually only Gainer makes payments. If a user is both, they might have a Gainer profile.
            // Let's check for a gainer profile regardless for others.
            const gainer = await prisma.gainer.findUnique({
                where: { UserId: userId }
            });

            if (gainer) {
                payments = await prisma.payment.findMany({
                    where: { GainerId: gainer.GainerId },
                    include: {
                        request: {
                            include: {
                                organization: {
                                    select: {
                                        OrganizationName: true,
                                        Location: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { PaymentDate: 'desc' }
                });
            } else {
                return res.status(200).json({ payments: [] });
            }
        }

        return res.status(200).json({ success: true, payments });
    } catch (error: any) {
        console.error("Fetch Payment History Error:", error.message);
        return res.status(500).json({
            message: "Internal Server Error fetching payment history",
            error: error.message
        });
    }
};
