
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
// We CANNOT directly import the TS files from api/ because they use ES modules and TS.
// But we are running with 'tsx', so we CAN import them dynamically or statically if configured right.
// However, the api files default export a function.

// Using dynamic imports to load the handlers
// We need to map generic Express req/res to VercelReq/Res style (duck typing)
const app = express();
app.use(express.json());

// Helper to adapt Express logic to Vercel handler
const adapt = async (handlerPath, req, res) => {
    try {
        // Dynamic import of the TS file. tsx handles the transpilation on the fly.
        const module = await import(handlerPath);
        const handler = module.default;

        // Vercel Request adds .query, .body, .cookies etc. Express has these.
        // We just pass req, res directly as they are compatible enough for this usage.
        await handler(req, res);
    } catch (e) {
        console.error(`Error handling ${req.path}:`, e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Local Server Error', details: e.message });
        }
    }
};

// Route Definitions
// Pharmacies
app.get('/api/pharmacies', (req, res) => adapt('./api/pharmacies.ts', req, res));

// Medications
app.get('/api/medications', (req, res) => adapt('./api/medications.ts', req, res));

// History
app.get('/api/history', (req, res) => adapt('./api/history.ts', req, res));
app.post('/api/history', (req, res) => adapt('./api/history.ts', req, res));

// Void
app.post('/api/history/void', (req, res) => adapt('./api/history/void.ts', req, res));

// Chat
app.post('/api/chat', (req, res) => adapt('./api/chat.ts', req, res));


const PORT = 3001;
app.listen(PORT, () => {
    console.log(`
🚀 Local API Server running at http://localhost:${PORT}
   - /api/pharmacies
   - /api/medications
   - /api/history
   Proxy configured in Vite should forward /api requests here.
`);
});
