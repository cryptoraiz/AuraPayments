import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PaymentForm from '../components/forms/PaymentForm';

export default function InvoicePage() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const invoiceHistory = [
    { id: 'INV-001', client: 'Alice Crypto', amount: '500.00 USDC', status: 'Paid', date: 'Today' },
    { id: 'INV-002', client: 'Bob Builder', amount: '1,200.00 EURC', status: 'Pending', date: 'Yesterday' },
    { id: 'INV-003', client: 'Charlie Node', amount: '0.15 ETH', status: 'Paid', date: '3 days ago' },
    { id: 'INV-004', client: 'Dave Miner', amount: '3,000.00 USDC', status: 'Expired', date: 'Last week' },
    { id: 'INV-005', client: 'Eve Validator', amount: '250.00 USDC', status: 'Paid', date: 'Last week' },
    { id: 'INV-006', client: 'Frank Staker', amount: '5,000.00 EURC', status: 'Paid', date: '2 weeks ago' },
    { id: 'INV-007', client: 'Grace Ledger', amount: '0.80 ETH', status: 'Pending', date: '2 weeks ago' },
    { id: 'INV-008', client: 'Heidi Wallet', amount: '150.00 USDC', status: 'Paid', date: '2 weeks ago' },
    { id: 'INV-009', client: 'Ivan Token', amount: '800.00 USDC', status: 'Expired', date: '3 weeks ago' },
    { id: 'INV-010', client: 'Judy Chain', amount: '1,500.00 EURC', status: 'Paid', date: '3 weeks ago' },
    { id: 'INV-011', client: 'Mallory Hack', amount: '0.05 ETH', status: 'Paid', date: 'Last month' },
    { id: 'INV-012', client: 'Oscar Bridge', amount: '4,200.00 USDC', status: 'Pending', date: 'Last month' },
  ];

  const totalPages = Math.ceil(invoiceHistory.length / itemsPerPage);
  const currentInvoices = invoiceHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pendingCount = invoiceHistory.filter(inv => inv.status === 'Pending').length;

  return (
    <section className="flex-1 flex flex-col items-center justify-start pt-4 pb-4 w-full">
      <div className="w-full max-w-4xl mx-auto px-6 flex flex-col items-center">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-white mb-2">Invoice 2.0</h1>
          <p className="text-dark-muted">Create professional crypto payment links instantly.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm mb-4">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'create' 
                ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            Create Invoice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
              activeTab === 'history' 
                ? 'text-white bg-dark-card shadow-lg ring-1 ring-white/10' 
                : 'text-dark-muted hover:text-gray-300'
            }`}
          >
            History & Pending
            {pendingCount > 0 && (
              <span className="w-5 h-5 bg-yellow-500 text-black text-[10px] font-black flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-[pulse_2s_ease-in-out_infinite]">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
        
        <div className="grid w-full items-start justify-items-center">
          <AnimatePresence>
            {activeTab === 'create' && (
              <motion.div 
                key="create"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="col-start-1 row-start-1 w-full flex justify-center"
              >
                <div className="w-full max-w-[540px] relative min-h-[540px] h-auto flex flex-col">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-50 pointer-events-none"></div>
                  <div className="flex-1 overflow-hidden [&>div]:h-full">
                    <PaymentForm theme="modern" />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="col-start-1 row-start-1 w-full flex justify-center"
              >
                <div className="w-full max-w-[540px] bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[540px] h-auto">
              {/* History List */}
              <div className="grid grid-cols-4 px-6 py-4 border-b border-dark-border/50 text-xs font-bold text-dark-muted uppercase tracking-wider">
                <div className="col-span-1">Invoice ID</div>
                <div className="col-span-1">Client</div>
                <div className="col-span-1 text-right">Amount</div>
                <div className="col-span-1 text-right">Status</div>
              </div>
              
              <div>
                {currentInvoices.map((inv, idx) => (
                  <div key={idx} className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors">
                    <div className="col-span-1">
                      <div className="font-bold text-white text-sm">{inv.id}</div>
                      <div className="text-xs text-dark-muted">{inv.date}</div>
                    </div>
                    <div className="col-span-1 text-sm font-medium text-dark-muted truncate pr-2">
                      {inv.client}
                    </div>
                    <div className="col-span-1 text-right">
                      <div className="font-bold text-white tracking-wide">{inv.amount}</div>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-1.5 rounded-lg inline-block ${
                        inv.status === 'Paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                        inv.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-auto flex items-center justify-between px-6 py-4 bg-dark-bg/50 border-t border-dark-border">
                    <span className="text-xs text-dark-muted font-medium">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, invoiceHistory.length)} of {invoiceHistory.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-input border border-dark-border/50 text-white hover:bg-dark-border disabled:opacity-30 disabled:hover:bg-dark-input transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                            currentPage === i + 1 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-dark-input border border-dark-border/50 text-dark-muted hover:text-white hover:bg-dark-border'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}

                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-input border border-dark-border/50 text-white hover:bg-dark-border disabled:opacity-30 disabled:hover:bg-dark-input transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
