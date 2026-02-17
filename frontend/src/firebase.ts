// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAvbxUq74JwsWLb240z4VADuOvKNmuflyQ",
    authDomain: "onlineprintoutadmin.firebaseapp.com",
    projectId: "onlineprintoutadmin",
    storageBucket: "onlineprintoutadmin.firebasestorage.app",
    messagingSenderId: "1030702592381",
    appId: "1:1030702592381:web:31c74931b11b6a19f6dc14",
    measurementId: "G-SDRNJKPZS2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, analytics };
