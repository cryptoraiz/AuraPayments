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
    const [selectedTrade, setSelectedTrade] = useState(null);

    const handleWalletSelect = (connector) => {
        connect({ connector });
        setShowWalletModal(false);
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedTrade(null);
            setSearchQuery('');
        }
    }, [isOpen]);

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
        
        // Remove artificial loading delay
        setIsLoading(false);
    }, [address, isConnected, isOpen]);

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
                    <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors z-10 bg-black/40 p-2 rounded-full backdrop-blur-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <AnimatePresence mode="wait">
                        {!selectedTrade ? (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                {/* Header: Unique Aura Theme */}
                                <div className="flex flex-col items-center mt-2 mb-6">
                                    <h2 className="text-[26px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight mb-1 text-center">
                                        Transaction Log
                                    </h2>
                                    <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Your recent activity</span>
                                </div>

                                {/* Search Bar - Sleek Pill Design */}
                                <div className="relative mb-6 shrink-0 group">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400 text-dark-muted">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Filter tokens or chains..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 text-white text-[14px] rounded-full pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-white/20 font-medium"
                                    />
                                </div>

                                {/* Links List - Timeline Aesthetic */}
                                <div className="flex-1 pb-4 overflow-y-auto pr-3 custom-scrollbar relative">
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
                                        <div className="flex flex-col gap-6 relative">
                                            {filteredTrades.map(item => (
                                                <div key={item.id} className="relative group cursor-pointer" onClick={() => setSelectedTrade(item)}>

                                                    {/* Content Card (Minimal Glass) */}
                                                    <div className="bg-white/[0.01] hover:bg-white/[0.04] border border-transparent hover:border-white/10 rounded-2xl p-4 transition-all duration-300">
                                                        
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-black/50 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                                    <img src={getTokenIcon(item.tokenIn)} alt={item.tokenIn} className="w-full h-full object-cover" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-white font-semibold text-[15px]">
                                                                        {item.type} {item.amountIn} {item.tokenIn}
                                                                    </h3>
                                                                    <p className="text-white/40 text-[11px] font-medium tracking-wide uppercase">
                                                                        {item.type === 'Bridge' ? 'Cross-Chain (CCTP)' : 'Synthra AMM'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-white/40 text-[12px] font-medium block mb-1">
                                                                    {timeAgo(Number(item.createdAt))}
                                                                </span>
                                                                <div className="flex items-center justify-end -space-x-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                                    <img src={getChainIcon(item.fromChain || 'Arc Testnet')} className="w-4 h-4 rounded-full z-10 border border-[#1C1C1E]" alt="chain" />
                                                                    {item.type === 'Bridge' && (
                                                                        <img src={getChainIcon(item.toChain)} className="w-4 h-4 rounded-full z-0 border border-[#1C1C1E]" alt="chain" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between mt-4">
                                                            <div className="flex items-center gap-1.5 text-emerald-400/90 bg-emerald-400/10 px-2.5 py-1 rounded-md">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                                <span className="text-[11px] font-bold uppercase tracking-wider">Confirmed</span>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1 text-[12px] font-medium text-white/50 group-hover:text-blue-400 transition-colors">
                                                                Details
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex flex-col h-full"
                            >
                                {/* Top Area: Big Icons and Title */}
                                <div className="flex flex-col items-center mt-6 mb-8 pt-4">
                                    <div className="flex items-center gap-5 mb-5">
                                        <div className="relative">
                                            <div className="w-[60px] h-[60px] rounded-full bg-[#1C1C1E] flex items-center justify-center p-1 border-2 border-white/5 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                                                <img src={getTokenIcon(selectedTrade.tokenIn)} className="w-full h-full rounded-full object-cover" alt="token in" />
                                            </div>
                                            <img src={getChainIcon(selectedTrade.fromChain || 'Arc Testnet')} className="w-6 h-6 rounded-full absolute -bottom-1 -right-1 border-[3px] border-[#1C1C1E] bg-[#1C1C1E]" alt="chain" />
                                        </div>
                                        
                                        <div className="text-white/20">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </div>

                                        <div className="relative">
                                            <div className="w-[60px] h-[60px] rounded-full bg-[#1C1C1E] flex items-center justify-center p-1 border-2 border-white/5 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                                                <img src={getTokenIcon(selectedTrade.tokenOut || selectedTrade.tokenIn)} className="w-full h-full rounded-full object-cover" alt="token out" />
                                            </div>
                                            <img src={getChainIcon(selectedTrade.toChain || selectedTrade.fromChain || 'Arc Testnet')} className="w-6 h-6 rounded-full absolute -bottom-1 -right-1 border-[3px] border-[#1C1C1E] bg-[#1C1C1E]" alt="chain" />
                                        </div>
                                    </div>

                                    <h2 className="text-[26px] font-extrabold text-white tracking-tight mb-1 text-center">
                                        {selectedTrade.type} {selectedTrade.amountIn} {selectedTrade.tokenIn}
                                    </h2>
                                    <span className="text-sm font-medium text-white/50 bg-white/5 px-3 py-1 rounded-full mt-2">
                                        via {selectedTrade.type === 'Bridge' ? 'CCTP' : 'Synthra AMM'}
                                    </span>
                                </div>

                                {/* Information Card */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-5 space-y-4 shadow-xl">
                                   
                                   {/* From */}
                                   <div className="flex justify-between items-center">
                                       <div className="flex items-center gap-2 text-white/60">
                                           <img src={getChainIcon(selectedTrade.fromChain || 'Arc Testnet')} className="w-5 h-5 rounded-full" alt="chain" />
                                           <span className="text-[14px] font-medium">From {selectedTrade.fromChain || 'Arc Testnet'}</span>
                                       </div>
                                       <div className="text-[14px] font-bold text-white flex items-center gap-1.5">
                                           {selectedTrade.amountIn} {selectedTrade.tokenIn}
                                           <img src={getTokenIcon(selectedTrade.tokenIn)} className="w-4 h-4 rounded-full" alt="token" />
                                       </div>
                                   </div>
                                   
                                   <div className="h-px bg-white/5 w-full"></div>

                                   {/* To */}
                                   <div className="flex justify-between items-center">
                                       <div className="flex items-center gap-2 text-white/60">
                                           <img src={getChainIcon(selectedTrade.toChain || selectedTrade.fromChain || 'Arc Testnet')} className="w-5 h-5 rounded-full" alt="chain" />
                                           <span className="text-[14px] font-medium">To {selectedTrade.toChain || 'Arc Testnet'}</span>
                                       </div>
                                       <div className="text-[14px] font-bold text-white flex items-center gap-1.5">
                                           {selectedTrade.amountOut || selectedTrade.amountIn} {selectedTrade.tokenOut || selectedTrade.tokenIn}
                                           <img src={getTokenIcon(selectedTrade.tokenOut || selectedTrade.tokenIn)} className="w-4 h-4 rounded-full" alt="token" />
                                       </div>
                                   </div>

                                   <div className="h-px bg-white/5 w-full"></div>

                                   {/* Route/Method */}
                                   <div className="flex justify-between items-center">
                                       <div className="flex items-center gap-2 text-white/60 text-[14px] font-medium">
                                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                           <span>Route</span>
                                       </div>
                                       <div className="text-[14px] font-bold text-blue-400 flex items-center gap-1">
                                            {selectedTrade.type === 'Bridge' ? 'CCTP (Fast)' : 'Synthra (Fast)'}
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                       </div>
                                   </div>

                                   <div className="h-px bg-white/5 w-full"></div>

                                   {/* Hash */}
                                   <div className="flex justify-between items-center">
                                       <div className="text-white/60 text-[14px] font-medium">Transaction Hash</div>
                                       <a href={`https://testnet.arcscan.app/tx/${selectedTrade.hash}`} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-white hover:text-blue-400 flex items-center gap-1.5 transition-colors underline decoration-white/20 underline-offset-2">
                                           View Transaction
                                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                       </a>
                                   </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-auto pt-6 pb-2">
                                   <button 
                                        onClick={() => setSelectedTrade(null)} 
                                        className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 border border-white/10"
                                   >
                                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                       Back to Timeline
                                   </button>
                                </div>

                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
