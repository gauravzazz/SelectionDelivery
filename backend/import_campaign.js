const XLSX = require('xlsx');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase if not already
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'onlineprintoutadmin'
    });
}
const db = admin.firestore();

async function importCampaign() {
    console.log('🚀 Starting Campaign Import...');
    const filePath = path.join(__dirname, '../shipments_report_2026-02-17_080304.xlsx');

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`📊 Found ${data.length} records in Excel.`);

        const collection = db.collection('review_leads');
        const batch = db.batch();
        let count = 0;
        const seenPhones = new Set();

        for (const row of data) {
            const name = row['Customer'];
            const phone = String(row['Mobile'] || '').replace(/\D/g, '').slice(-10);

            if (!name || !phone || phone.length !== 10) continue;
            if (seenPhones.has(phone)) continue;
            seenPhones.add(phone);

            const docId = `lead_${phone}`;
            const docRef = collection.doc(docId);

            // Check if already exists to avoid overwriting or duplicates
            // We use batch for efficiency
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

        console.log(`🎉 Success! ${count} unique leads imported to 'review_leads'.`);
    } catch (error) {
        console.error('❌ Import failed:', error);
    }
}

importCampaign();
