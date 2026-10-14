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
export const getPaymentLinksByWallet = (walletAddress, chainId) => {
    const links = getPaymentLinks();
    return links.filter(
        link => {
            if (!link || link.creatorAddress?.toLowerCase() !== walletAddress?.toLowerCase()) return false;
            if (!chainId) return true;
            const isMainnetRequest = chainId === 5042;
            const mentionsTestnet = 
                (link.network && (link.network.toLowerCase().includes('testnet') || link.network.toLowerCase().includes('sepolia'))) ||
                link.chainId === 5042002;
            const isLinkMainnet = !mentionsTestnet && (
                link.chainId === 5042 ||
                (link.network && link.network.toLowerCase().includes('mainnet'))
            );
            return isMainnetRequest ? isLinkMainnet : !isLinkMainnet;
        }
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

// SENT PAYMENTS MANAGEMENT 

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
export const getSentPaymentsByWallet = (walletAddress, chainId) => {
    const payments = getSentPayments();
    return payments.filter(
        payment => {
            if (!payment || payment.payer?.toLowerCase() !== walletAddress?.toLowerCase()) return false;
            if (!chainId) return true;
            const isMainnetRequest = chainId === 5042;
            const mentionsTestnet = 
                (payment.network && (payment.network.toLowerCase().includes('testnet') || payment.network.toLowerCase().includes('sepolia'))) ||
                payment.chainId === 5042002;
            const isPaymentMainnet = !mentionsTestnet && (
                payment.chainId === 5042 ||
                (payment.network && payment.network.toLowerCase().includes('mainnet'))
            );
            return isMainnetRequest ? isPaymentMainnet : !isPaymentMainnet;
        }
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

// BLACKLIST MANAGEMENT (Hide persistent backend items) 
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

// TRADE HISTORY MANAGEMENT 

const TRADE_HISTORY_KEY = 'arc_trade_history';

export const getTradeHistory = () => {
    try {
        const raw = localStorage.getItem(TRADE_HISTORY_KEY);
        let trades = raw ? JSON.parse(raw) : [];
        // Auto-purge legacy simulation test trades (e.g. 10 EURC from tests 70+ days ago)
        const hasLegacy = trades.some(t => 
            (t.tokenIn === 'EURC' && Number(t.amountIn) === 10) ||
            (!t.walletAddress && !t.txHash)
        );
        if (hasLegacy) {
            trades = trades.filter(t => 
                !(t.tokenIn === 'EURC' && Number(t.amountIn) === 10) &&
                !(!t.walletAddress && !t.txHash)
            );
            localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(trades));
        }
        return trades;
    } catch (error) {
        console.error('Error reading trade history:', error);
        return [];
    }
};

export const deleteTrade = (tradeId) => {
    try {
        const trades = getTradeHistory();
        const filtered = trades.filter(t => t.id !== tradeId);
        localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error deleting trade:', error);
        return false;
    }
};

export const clearTradeHistoryByWallet = (walletAddress) => {
    try {
        const trades = getTradeHistory();
        const filtered = trades.filter(t => t.walletAddress?.toLowerCase() !== walletAddress?.toLowerCase());
        localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error clearing trade history:', error);
        return false;
    }
};

export const saveTrade = (tradeData) => {
    try {
        const trades = getTradeHistory();
        trades.push({
            id: Date.now().toString(),
            createdAt: Date.now(),
            ...tradeData
        });
        localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(trades));
        return true;
    } catch (error) {
        console.error('Error saving trade:', error);
        return false;
    }
};

export const getTradeHistoryByWallet = (walletAddress, chainId) => {
    const trades = getTradeHistory();
    return trades.filter(
        trade => {
            if (!trade || trade.walletAddress?.toLowerCase() !== walletAddress?.toLowerCase()) return false;
            if (!chainId) return true;
            const isMainnetRequest = chainId === 5042;
            const mentionsTestnet = 
                (trade.fromChain && (trade.fromChain.toLowerCase().includes('sepolia') || trade.fromChain.toLowerCase().includes('testnet'))) ||
                (trade.toChain && (trade.toChain.toLowerCase().includes('sepolia') || trade.toChain.toLowerCase().includes('testnet'))) ||
                (trade.network && (trade.network.toLowerCase().includes('sepolia') || trade.network.toLowerCase().includes('testnet'))) ||
                trade.chainId === 5042002 || trade.chainId === 84532 || trade.chainId === 11155111 || trade.chainId === 421614;

            const isTradeMainnet = !mentionsTestnet && (
                trade.chainId === 5042 ||
                trade.fromChain === 'Arc Mainnet' ||
                (trade.network && trade.network.toLowerCase().includes('mainnet'))
            );
            return isMainnetRequest ? isTradeMainnet : !isTradeMainnet;
        }
    );
};

// PENDING BRIDGE RECOVERY MANAGEMENT
const PENDING_BRIDGE_KEY = 'aura_pending_bridge_';

export const savePendingBridge = (bridgeData) => {
    try {
        if (!bridgeData?.userAddress) return false;
        const key = `${PENDING_BRIDGE_KEY}${bridgeData.userAddress.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(bridgeData));
        window.dispatchEvent(new Event('pending_bridge_updated'));
        return true;
    } catch (e) {
        console.error('Error saving pending bridge:', e);
        return false;
    }
};

export const getPendingBridge = (walletAddress) => {
    try {
        if (!walletAddress) return null;
        const key = `${PENDING_BRIDGE_KEY}${walletAddress.toLowerCase()}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

export const clearPendingBridge = (walletAddress) => {
    try {
        if (!walletAddress) return false;
        const key = `${PENDING_BRIDGE_KEY}${walletAddress.toLowerCase()}`;
        localStorage.removeItem(key);
        window.dispatchEvent(new Event('pending_bridge_updated'));
        return true;
    } catch (e) {
        return false;
    }
};

export const updateTradeByHash = (txHash, updates) => {
    try {
        const trades = getTradeHistory();
        const idx = trades.findIndex(t => 
            (t.txHash && t.txHash.toLowerCase() === txHash.toLowerCase()) || 
            (t.hash && t.hash.toLowerCase() === txHash.toLowerCase())
        );
        if (idx !== -1) {
            trades[idx] = { ...trades[idx], ...updates };
            localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(trades));
            window.dispatchEvent(new Event('storage'));
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
};
