import { Router } from 'express';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import * as path from 'path';

const router = Router();

// One-time import route
router.post('/import', async (req, res) => {
    console.log('🚀 Starting Campaign Import via API...');
    const filePath = '/Users/gauravupadhyay/Desktop/Delivery/shipments_report_2026-02-17_080304.xlsx';

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const collection = db.collection('review_leads');
        const batch = db.batch();
        let count = 0;
        const seenPhones = new Set();

        for (const row of data as any[]) {
            const name = row['Customer'];
            const phone = String(row['Mobile'] || '').replace(/\D/g, '').slice(-10);

            if (!name || !phone || phone.length !== 10) continue;
            if (seenPhones.has(phone)) continue;
            seenPhones.add(phone);

            const docId = `lead_${phone}`;
            const docRef = collection.doc(docId);

            batch.set(docRef, {
                name,
                phone,
                status: 'pending',
                importedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });

            count++;
            if (count % 400 === 0) {
                await batch.commit();
                console.log(`✅ Progress: ${count} imported...`);
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }

        res.json({ success: true, count, message: `${count} leads imported successfully.` });
    } catch (error: any) {
        console.error('❌ Import failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update lead status
router.post('/status', async (req, res) => {
    const { phone, status } = req.body;
    if (!phone || !status) {
        res.status(400).json({ error: 'Missing phone or status' });
        return;
    }

    try {
        const docRef = db.collection('review_leads').doc(`lead_${phone}`);
        await docRef.update({
            status,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
