/**
 * LocalStorage utility for managing Arc Invoice payment links
 */

const STORAGE_KEY = 'arc_invoice_payment_links';

/**
 * Get all payment links from localStorage
 */
export const getPaymentLinks = () => {
    try {
        const links = localStorage.getItem(STORAGE_KEY);
        return links ? JSON.parse(links) : [];
    } catch (error) {
        console.error('Error reading payment links:', error);
        return [];
    }
};

/**
 * Save a new payment link
 */
export const savePaymentLink = (linkData) => {
    try {
        const links = getPaymentLinks();
        links.push({
            ...linkData,
            createdAt: Date.now(),
            status: 'pending'
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
        return true;
    } catch (error) {
        console.error('Error saving payment link:', error);
        return false;
    }
};

/**
 * Update payment link status (e.g., mark as paid)
 */
export const updatePaymentLink = (linkId, updates) => {
    try {
        const links = getPaymentLinks();
        const index = links.findIndex(link => link.id === linkId);

        if (index !== -1) {
            links[index] = { ...links[index], ...updates };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating payment link:', error);
        return false;
    }
};

/**
 * Get payment links filtered by wallet address
 */
export const getPaymentLinksByWallet = (walletAddress) => {
    const links = getPaymentLinks();
    return links.filter(
        link => link.creatorAddress?.toLowerCase() === walletAddress?.toLowerCase()
    );
};

/**
 * Get payment link by ID
 */
export const getPaymentLinkById = (linkId) => {
    const links = getPaymentLinks();
    return links.find(link => link.id === linkId);
};

/**
 * Delete a payment link
 */
export const deletePaymentLink = (linkId) => {
    try {
        const links = getPaymentLinks();
        const filtered = links.filter(link => link.id !== linkId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error deleting payment link:', error);
        return false;
    }
};

/**
 * Clear payment links with scope
 */
export const clearPaymentLinksByScope = (scope = 'all', walletAddress) => {
    try {
        if (scope === 'all') {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        }

        let links = getPaymentLinks();
        const blacklistIds = [];

        // Return TRUE to KEEP, FALSE to DELETE
        links = links.filter(link => {
            // If wallet specific clearing is needed, check ownership first
            const isOwner = link.creatorAddress?.toLowerCase() === walletAddress?.toLowerCase();
            if (walletAddress && !isOwner) return true; // Keep others

            let shouldDelete = false;

            if (scope === 'pending') {
                // Delete if pending AND created > 24h ago
                const isRecent = (Date.now() - link.createdAt) < (24 * 60 * 60 * 1000);
                if (link.status === 'pending' && isRecent) shouldDelete = true;
            }
            if (scope === 'expired') {
                // Delete if pending AND created >= 24 hours ago
                const isOld = (Date.now() - link.createdAt) >= (24 * 60 * 60 * 1000);
                if (link.status === 'pending' && isOld) shouldDelete = true;
            }
            if (scope === 'received') {
                // For 'received', it's usually checking if status is paid. 
                // LocalStorage 'links' are usually ones WE created (so we are receiver).
                if (link.status === 'paid') shouldDelete = true;
            }

            if (shouldDelete) {
                blacklistIds.push(link.id);
                return false;
            }
            return true;
        });

        if (blacklistIds.length > 0) {
            addToBlacklist(blacklistIds);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
        return true;
    } catch (error) {
        console.error('Error clearing payment links:', error);
        return false;
    }
};

// ===== SENT PAYMENTS MANAGEMENT =====

const SENT_PAYMENTS_KEY = 'arc_invoice_sent_payments';

/**
 * Get all sent payments from localStorage
 */
export const getSentPayments = () => {
    try {
        const payments = localStorage.getItem(SENT_PAYMENTS_KEY);
        return payments ? JSON.parse(payments) : [];
    } catch (error) {
        console.error('Error reading sent payments:', error);
        return [];
    }
};

/**
 * Save a sent payment record
 */
export const saveSentPayment = (paymentData) => {
    try {
        const payments = getSentPayments();

        // Prevent Duplicates: Check if txHash or ID already exists
        const exists = payments.some(p =>
            (paymentData.txHash && p.txHash === paymentData.txHash) ||
            (paymentData.id && p.id === paymentData.id)
        );

        if (exists) {
            // console.log("Payment already saved, skipping duplicate.");
            return true;
        }

        payments.push({
            ...paymentData,
            paidAt: Date.now()
        });
        localStorage.setItem(SENT_PAYMENTS_KEY, JSON.stringify(payments));
        return true;
    } catch (error) {
        console.error('Error saving sent payment:', error);
        return false;
    }
};

/**
 * Get sent payments filtered by payer wallet address
 */
export const getSentPaymentsByWallet = (walletAddress) => {
    const payments = getSentPayments();
    return payments.filter(
        payment => payment.payer?.toLowerCase() === walletAddress?.toLowerCase()
    );
};

/**
 * Clear sent payments with scope
 */
export const clearSentPaymentsByScope = (scope = 'all', walletAddress) => {
    try {
        // 'sent' items are ONLY relevant for 'sent' scope or 'all'
        if (scope !== 'all' && scope !== 'sent') return true; // Do nothing

        if (scope === 'all') {
            localStorage.removeItem(SENT_PAYMENTS_KEY);
            return true;
        }

        if (scope === 'sent') {
            // Delete ALL sent payments for this wallet
            let payments = getSentPayments();
            payments = payments.filter(p => {
                const isPayer = p.payer?.toLowerCase() === walletAddress?.toLowerCase();
                return !isPayer; // Keep if NOT payer (i.e. delete if IS payer)
            });
            localStorage.setItem(SENT_PAYMENTS_KEY, JSON.stringify(payments));
            return true;
        }

        return true;
    } catch (error) {
        console.error('Error clearing sent payments:', error);
        return false;
    }
};

// ===== BLACKLIST MANAGEMENT (Hide persistent backend items) =====
const BLACKLIST_KEY = 'arc_invoice_blacklist';

export const syncLocalLinks = (latestItems) => {
    try {
        const localLinks = getPaymentLinks();
        let hasChanges = false;

        const updatedLinks = localLinks.map(local => {
            // Find matching item in the latest data (backend result)
            const fresh = latestItems.find(i => i.id === local.id);

            // If we have newer info, update the local status
            if (fresh && fresh.status && fresh.status !== local.status) {
                hasChanges = true;
                return { ...local, status: fresh.status };
            }
            return local;
        });

        if (hasChanges) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLinks));
            // Update the event to notify listeners
            window.dispatchEvent(new Event('storage'));
        }
    } catch (error) {
        console.error('Error syncing local links:', error);
    }
};

export const getBlacklist = () => {
    try {
        const list = localStorage.getItem(BLACKLIST_KEY);
        return list ? JSON.parse(list) : [];
    } catch { return []; }
};

export const addToBlacklist = (ids) => {
    try {
        const current = getBlacklist();
        const newIds = ids.filter(id => !current.includes(id));
        if (newIds.length > 0) {
            localStorage.setItem(BLACKLIST_KEY, JSON.stringify([...current, ...newIds]));
        }
    } catch (e) { console.error('Error updating blacklist:', e); }
};
