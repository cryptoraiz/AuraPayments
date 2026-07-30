import { useState, useEffect, useMemo } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { getTradeHistoryByWallet } from '../../utils/localStorage';
import WalletModal from './WalletModal';
import { motion, AnimatePresence } from 'framer-motion';
import { TOKENS } from '../../config/tokens';
import { getAllChains } from '../../config/chains';

// Helpers
function timeAgo(ms) {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return `${seconds || 1} secs ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
}

function getTokenIcon(symbol) {
    const t = TOKENS.find(x => x.symbol === symbol);
    return t ? t.iconImg : 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png';
}

function getChainIcon(chainName) {
    if (!chainName) return 'https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png';
    const c = getAllChains().find(x => x.name === chainName);
    return c ? c.icon : 'https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png';
}

export default function TradeHistoryModal({ isOpen, onClose }) {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [trades, setTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const handleWalletSelect = (connector) => {
        connect({ connector });
        setShowWalletModal(false);
    };

    useEffect(() => {
        setIsLoading(true);
        if (isConnected && address) {
            const history = getTradeHistoryByWallet(address);
            // Sort by newest first
            history.sort((a, b) => b.createdAt - a.createdAt);
            setTrades(history);
        } else {
            setTrades([]);
        }
        
        // Simular um loading bem rapido para ficar elegante
        setTimeout(() => setIsLoading(false), 800);
    }, [address, isConnected]);

    const filteredTrades = useMemo(() => {
        if (!searchQuery) return trades;
        const q = searchQuery.toLowerCase();
        return trades.filter(t => 
            (t.tokenIn && t.tokenIn.toLowerCase().includes(q)) ||
            (t.tokenOut && t.tokenOut.toLowerCase().includes(q)) ||
            (t.fromChain && t.fromChain.toLowerCase().includes(q)) ||
            (t.toChain && t.toChain.toLowerCase().includes(q)) ||
            (t.hash && t.hash.toLowerCase().includes(q))
        );
    }, [trades, searchQuery]);

    const HistorySkeleton = () => (
        <div className="bg-transparent border border-dark-border rounded-2xl p-5 animate-pulse">
            <div className="flex justify-between mb-4">
                <div className="w-20 h-6 bg-white/10 rounded-full"></div>
                <div className="w-24 h-6 bg-white/10 rounded-full"></div>
            </div>
            <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="w-1/2 h-6 bg-white/10 rounded"></div>
            </div>
            <div className="w-32 h-6 bg-white/10 rounded-full"></div>
        </div>
    );

    if (!isOpen) return null;

    if (!isConnected) return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-[#1C1C1E] border border-dark-border rounded-[32px] w-full max-w-[420px] shadow-2xl overflow-hidden p-8 text-center relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="relative mb-8 mx-auto w-24 h-24 mt-4">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full border border-white/10 flex items-center justify-center p-5">
                                <svg className="w-10 h-10 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                            Connect your wallet
                        </h2>
                        <p className="text-gray-400 text-base leading-relaxed mb-8">
                            Connect your wallet to securely access your Swap and Bridge transaction activity.
                        </p>

                        <button
                            onClick={() => setShowWalletModal(true)}
                            className="w-full mt-2 py-4 rounded-2xl transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-lg"
                        >
                            Connect Wallet
                        </button>
                </motion.div>
            </motion.div>
            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                connectors={connectors}
                onSelectWallet={handleWalletSelect}
            />
        </AnimatePresence>
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-[#1C1C1E] border border-dark-border rounded-[32px] w-full max-w-[420px] h-[580px] shadow-2xl overflow-hidden p-6 relative flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors z-10">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Header: Activity Tab style */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            Activity Tab
                        </h2>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4 shrink-0">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="search by token hash/symbol/chain"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-dark-bg/50 border border-dark-border text-white text-[15px] rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-white/20 transition-colors placeholder:text-dark-muted font-medium"
                        />
                    </div>

                {/* Links List */}
                <div className="flex-1 space-y-3 pb-4 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="grid gap-3">
                            {[1, 2, 3].map((i) => (
                                <HistorySkeleton key={i} />
                            ))}
                        </div>
                    ) : filteredTrades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-zinc-600 space-y-4">
                            <p className="text-sm font-medium">No activity found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredTrades.map(item => (
                                <div key={item.id} className="bg-transparent border border-dark-border/80 rounded-2xl p-5 hover:bg-white/[0.02] transition-colors">
                                    
                                    {/* Top Row: Time & Network/Method */}
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[13px] font-semibold text-white/80">
                                            {timeAgo(Number(item.createdAt))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[13px] font-semibold text-white/80">
                                                {item.type === 'Bridge' ? 'CCTP (Fast)' : 'Synthra (Fast)'}
                                            </div>
                                            <div className="flex -space-x-2">
                                                <img src={getChainIcon(item.fromChain || 'Arc Testnet')} className="w-[22px] h-[22px] rounded-full z-10 border border-[#1C1C1E]" alt="chain" />
                                                {item.type === 'Bridge' && (
                                                    <img src={getChainIcon(item.toChain)} className="w-[22px] h-[22px] rounded-full z-0 border border-[#1C1C1E]" alt="chain" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Row: Token & Action */}
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-[34px] h-[34px] rounded-full bg-[#2C2C2E] flex items-center justify-center shrink-0">
                                            <img src={getTokenIcon(item.tokenIn)} alt={item.tokenIn} className="w-full h-full rounded-full" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white tracking-tight">
                                            {item.type} {item.amountIn} {item.tokenIn}
                                        </h3>
                                    </div>

                                    {/* Bottom Row: Status Badge & View Tx */}
                                    <div className="flex items-center justify-between">
                                        <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-full">
                                            <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-[13px] font-bold text-white">{item.type} Successful</span>
                                        </div>
                                        
                                        {item.hash && (
                                            <a
                                                href={`https://testnet.arcscan.app/tx/${item.hash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[13px] font-bold text-blue-400 hover:text-blue-300 transition-colors underline"
                                            >
                                                View Tx
                                            </a>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
