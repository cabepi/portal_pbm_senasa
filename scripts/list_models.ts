
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars from root .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    console.log("Checking available models for API Key ending in...", process.env.GOOGLE_API_KEY?.slice(-4));

    if (!process.env.GOOGLE_API_KEY) {
        console.error("No API Key found!");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        // Note: listModels is on the genAI instance or a specific manager? 
        // In 0.1.x it was different. In recent versions:
        // There isn't a direct helper on the main class in some versions, but let's try the recommended way or use Rest if needed.
        // Actually, the SDK might not expose listModels easily in the top level helper.
        // Let's check if we can just try a very standard one 'gemini-1.5-pro-latest' or use a fetch.

        // Wait, the error message literally says "Call ListModels".
        // Let's try to fetch it via REST if the SDK doesn't expose it clearly.
        // Or better, let's just use the fetch implementation to be sure.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Available Models:");
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods?.includes('generateContent')) {
                    console.log(`- ${m.name} (Supported)`);
                } else {
                    console.log(`- ${m.name} (Not for generateContent)`);
                }
            });
        } else {
            console.error("❌ Failed to list models:", data);
        }
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
