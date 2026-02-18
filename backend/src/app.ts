/**
 * Express Server Entry Point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import quoteRouter from './routes/quote';
import shipmentRouter from './routes/shipment';
import addressRouter from './routes/address';

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

// Compatibility routes for direct Function URL usage where '/api' prefix is not present.
app.use('/shipping-quote', quoteRouter);
app.use('/shipment', shipmentRouter);
app.use('/address', addressRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Print Shipping Engine' });
});

export default app;
