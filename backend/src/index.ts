/**
 * Express Server Entry Point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import quoteRouter from './routes/quote';

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

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`🚀 Print Shipping Engine running on http://127.0.0.1:${PORT}`);
});

export default app;
