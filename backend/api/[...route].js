// import '../env.js'; // DISABLE DOTENV IN PROD - Potential 500 cause
import express from 'express';
import cors from 'cors';

// MINIMAL DEBUG SERVER
// NO DB CONNECTION to start

const app = express();

app.use(cors());
app.use(express.json());
app.options('*', cors());

// Helper to handle errors in async handlers
const adapt = (handler) => async (req, res) => {
    try { await handler(req, res); } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
};

// Root Route (Safe)
app.get('/', (req, res) => res.json({ status: 'ok', msg: 'Backend Online - SAFE MODE' }));
app.get('/api', (req, res) => res.json({ status: 'ok', msg: 'API Root Online - SAFE MODE' }));

// Diagnostic (Safe - No Real DB Check yet)
app.get('/api/diagnose', (req, res) => {
    res.json({
        status: 'ok',
        mode: 'SAFE_MODE',
        node_env: process.env.NODE_ENV,
        has_pg_url: !!process.env.POSTGRES_URL
    });
});

// Mock Endpoints to prevent frontend 404s, but return errors
app.post('/api/invoices/create', (req, res) => res.status(503).json({ error: 'Maintenance Mode' }));
app.get('/api/invoices/get', (req, res) => res.status(503).json({ error: 'Maintenance Mode' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

export default app;
