import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'onlineprintoutadmin'
    });
}

export const db = admin.firestore();
