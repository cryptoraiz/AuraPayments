// import { getInvoicesCollection } from '../../lib/mongodb.js'; // Removed for Postgres migration

/**
 * PATCH /api/invoices/update
 * Update invoice status (e.g., mark as paid)
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id, status, txHash, payer, paidAt } = req.body;

        console.log('📥 UPDATE REQUEST RECEIVED:', { id, status, txHash, payer, paidAt });

        if (!id || !status) {
            console.log('❌ VALIDATION FAILED: Missing id or status');
            return res.status(400).json({
                error: 'Missing required fields: id, status'
            });
        }

        // Use JSON Store with additional fields
        const { db } = await import('../../lib/store.js');

        const additionalFields = {};
        if (txHash) additionalFields.txHash = txHash;
        if (payer) additionalFields.payer = payer;
        if (paidAt) additionalFields.paidAt = paidAt;

        console.log('🔄 Calling db.updateStatus with:', { id, status, additionalFields });
        const updatedInvoice = await db.updateStatus(id, status, additionalFields);

        if (!updatedInvoice) {
            console.log('❌ INVOICE NOT FOUND:', id);
            return res.status(404).json({ error: 'Invoice not found' });
        }

        console.log('✅ UPDATE SUCCESSFUL:', updatedInvoice);

        res.status(200).json({
            success: true,
            message: 'Invoice updated successfully',
            invoice: updatedInvoice
        });

    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
