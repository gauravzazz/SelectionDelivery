/**
 * Express Server Entry Point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import quoteRouter from './routes/quote';
import shipmentRouter from './routes/shipment';
import addressRouter from './routes/address';
import settingsRouter from './routes/settings';
import campaignRouter from './routes/campaign';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/shipping-quote', quoteRouter);
app.use('/api/shipment', shipmentRouter);
app.use('/api/address', addressRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/campaign', campaignRouter);

// Compatibility routes for direct Function URL usage where '/api' prefix is not present.
app.use('/shipping-quote', quoteRouter);
app.use('/shipment', shipmentRouter);
app.use('/address', addressRouter);
app.use('/settings', settingsRouter);
app.use('/campaign', campaignRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Print Shipping Engine' });
});

export default app;
