import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

// Export the "api" function
export const api = onRequest({
    region: "us-central1", // Match your Firebase project region
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
}, app);
