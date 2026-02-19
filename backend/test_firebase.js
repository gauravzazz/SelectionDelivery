const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'onlineprintoutadmin'
    });
}
const db = admin.firestore();

async function testConnection() {
    console.log('🔍 Testing Firestore connection...');
    try {
        const snapshot = await db.collection('orders').limit(1).get();
        console.log('✅ Connection successful. Orders found:', snapshot.size);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();
