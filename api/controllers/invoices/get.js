import { db } from '../../lib/store.js';

/**
 * GET /api/invoices/get?id=XYZ
 * Get a single invoice by ID
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Invoice ID required' });
        }

        const invoice = await db.findById(id);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.status(200).json({
            success: true,
            invoice
        });

    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
