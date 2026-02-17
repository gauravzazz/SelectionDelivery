import { Router } from 'express';
import { parseAddressWithGemini } from '../services/geminiService';

const router = Router();

router.post('/parse', async (req, res): Promise<void> => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            res.status(400).json({ error: 'Missing address text' });
            return;
        }

        const parsed = await parseAddressWithGemini(text);
        res.json({ success: true, parsed });

    } catch (error: any) {
        console.error('Address parsing failed:', error);
        res.status(500).json({ error: error.message || 'Failed to parse address' });
    }
});

export default router;
