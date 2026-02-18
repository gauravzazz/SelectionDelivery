import { Router } from 'express';
import { parseAddressHeuristic, parseAddressWithGemini } from '../services/geminiService';

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
        const fallback = parseAddressHeuristic(String(req.body?.text || ''));
        res.status(200).json({
            success: true,
            parsed: fallback,
            warning: 'Gemini parsing failed; heuristic fallback used.',
        });
    }
});

export default router;
