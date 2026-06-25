import { motion, AnimatePresence } from 'framer-motion';
import formCreateImg from '../../assets/tutorial/form-create.png';
import linkCreatedImg from '../../assets/tutorial/link-created.png';
import linkPendingImg from '../../assets/tutorial/link-pending.png';
import linkPaidImg from '../../assets/tutorial/link-paid.png';
import linkExpiredImg from '../../assets/tutorial/link-expired.png';
import historyListImg from '../../assets/tutorial/history-list.png';
import receiptImg from '../../assets/tutorial/receipt.png';

export default function IllustrationModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-7xl bg-[#0A0A0B] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mt-12"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 shadow-inner">
                                <span className="text-2xl">✨</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">How Arc Invoice Works</h2>
                                <p className="text-sm text-zinc-400">The complete lifecycle of a crypto payment.</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Staggered Container */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-16 bg-[#0A0A0B]">

                        {/* ACT 1: ISSUANCE */}
                        <motion.section
                            custom={0}
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0, y: 30 },
                                visible: (i) => ({
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        delay: i * 0.3 + 0.2, // Base delay + index * stagger
                                        duration: 0.6,
                                        type: "spring",
                                        bounce: 0.3
                                    }
                                })
                            }}
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm border border-blue-500/30">1</div>
                                <h3 className="text-xl font-bold text-white">The Request</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                            </div>

                            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center max-w-5xl mx-auto">
                                {/* Step 1.1: Create */}
                                <div className="space-y-4">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block text-center">Create Invoice</span>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-transform duration-500">
                                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                                        <img src={formCreateImg} alt="Create Form" className="w-full h-auto object-cover scale-[1.10]" />
                                    </div>
                                </div>

                                {/* Arrow Connector */}
                                <div className="hidden md:flex flex-col items-center justify-center gap-2 text-zinc-600 opacity-50">
                                    <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </div>

                                {/* Step 1.2: Created */}
                                <div className="space-y-4">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block text-center">Link Generated Instantly</span>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-transform duration-500">
                                        <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                                        <img src={linkCreatedImg} alt="Link Created" className="w-full h-auto object-cover scale-[1.10]" />
                                    </div>
                                </div>
                            </div>
                        </motion.section>

                        {/* ACT 2: CLIENT EXPERIENCE */}
                        <motion.section
                            custom={1}
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0, y: 30 },
                                visible: (i) => ({
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        delay: i * 0.3 + 0.2, // Base delay + index * stagger
                                        duration: 0.6,
                                        type: "spring",
                                        bounce: 0.3
                                    }
                                })
                            }}
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm border border-purple-500/30">2</div>
                                <h3 className="text-xl font-bold text-white">The Client Experience</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-purple-500/20 to-transparent"></div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                                {/* 2.1 Pending */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending</span>
                                    </div>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-transform duration-500">
                                        <img src={linkPendingImg} alt="Pending" className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>

                                {/* 2.2 Paid */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Paid Success</span>
                                    </div>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(16,185,129,0.2)] border border-emerald-500/20 bg-zinc-900/50 hover:border-white/30 scale-105 z-10">
                                        <img src={linkPaidImg} alt="Paid" className="w-full h-auto object-cover scale-[1.10]" />
                                    </div>
                                </div>

                                {/* 2.3 Expired */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Expired 24h</span>
                                    </div>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-transform duration-500 grayscale opacity-70 hover:grayscale-0 hover:opacity-100">
                                        <img src={linkExpiredImg} alt="Expired" className="w-full h-auto object-cover scale-[1.10]" />
                                    </div>
                                </div>
                            </div>
                        </motion.section>

                        {/* ACT 3: MANAGEMENT */}
                        <motion.section
                            custom={2}
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0, y: 30 },
                                visible: (i) => ({
                                    opacity: 1,
                                    y: 0,
                                    transition: {
                                        delay: i * 0.3 + 0.2, // Base delay + index * stagger
                                        duration: 0.6,
                                        type: "spring",
                                        bounce: 0.3
                                    }
                                })
                            }}
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm border border-emerald-500/30">3</div>
                                <h3 className="text-xl font-bold text-white">Management & Proof</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                                {/* 3.1 Activity */}
                                <div className="space-y-4">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block text-left pl-2">Real-time Dashboard</span>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-colors duration-500">
                                        <img src={historyListImg} alt="Activity" className="w-full h-auto object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-4 left-4">
                                                <span className="text-xs font-medium text-white bg-blue-500/20 border border-blue-500/30 px-2 py-1 rounded-lg">Live Updates</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3.2 Receipt */}
                                <div className="space-y-4">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block text-left pl-2">Professional Receipt</span>
                                    <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/50 hover:border-white/30 transition-colors duration-500">
                                        <img src={receiptImg} alt="Receipt" className="w-full h-auto object-cover scale-[1.10] object-top" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-4 left-4">
                                                <span className="text-xs font-medium text-white bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg">Downloadable PDF</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.section>



                    </div>
                </motion.div>
            </div>
        </AnimatePresence >
    );
}
