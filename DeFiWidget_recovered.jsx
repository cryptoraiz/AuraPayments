import { useState } from 'react';
import { motion } from 'framer-motion';

export default function DeFiWidget() {
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'bridge'
  const [amount, setAmount] = useState('');

  return (
    <div className="w-full max-w-[480px] mx-auto">
      {/* Widget Container */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden">
        
        {/* Header Tabs */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('swap')}
              className={`text-lg font-bold transition-colors ${
                activeTab === 'swap' ? 'text-white' : 'text-dark-muted hover:text-gray-300'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab('bridge')}
              className={`text-lg font-bold transition-colors ${
                activeTab === 'bridge' ? 'text-white' : 'text-dark-muted hover:text-gray-300'
              }`}
            >
              Bridge
            </button>
          </div>
          
          {/* Action Icons (Settings, Refresh, History) */}
          <div className="flex items-center gap-3 text-dark-muted">
            <button className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Input FROM */}
        <div className="bg-dark-input border border-dark-border/50 rounded-2xl p-4 transition-all focus-within:border-blue-500/50">
          <div className="text-sm font-medium text-dark-muted mb-2">
            {activeTab === 'swap' ? 'You pay' : 'Bridge from'}
          </div>
          <div className="flex items-center justify-between gap-4">
            {/* Token Selector Pill */}
            <button className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-colors rounded-full py-1.5 px-3">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
              <span className="font-semibold text-white">USDC</span>
              <svg className="w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Large Number Input */}
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-right text-3xl font-semibold text-white placeholder-dark-muted outline-none"
            />
          </div>
          <div className="flex justify-end mt-1 text-sm text-dark-muted font-medium">
            $0.00
          </div>
        </div>

        {/* Switch Direction Button */}
        <div className="relative h-2 flex items-center justify-center my-1 z-10">
          <button className="absolute w-10 h-10 bg-dark-input border-4 border-dark-card rounded-full flex items-center justify-center text-dark-muted hover:text-white transition-colors hover:bg-dark-border cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>

        {/* Input TO */}
        <div className="bg-dark-input border border-dark-border/50 rounded-2xl p-4 transition-all focus-within:border-blue-500/50">
          <div className="text-sm font-medium text-dark-muted mb-2">
            {activeTab === 'swap' ? 'You receive' : 'Bridge to'}
          </div>
          <div className="flex items-center justify-between gap-4">
            {/* Token Selector Pill */}
            <button className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 transition-colors rounded-full py-1.5 px-3">
              <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                E
              </div>
              <span className="font-semibold text-white">ETH</span>
              <svg className="w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Large Number Output */}
            <input
              type="number"
              placeholder="0.00"
              disabled
              className="w-full bg-transparent text-right text-3xl font-semibold text-white placeholder-dark-muted outline-none cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end mt-1 text-sm text-dark-muted font-medium">
            $0.00
          </div>
        </div>

        {/* Main Action Button */}
        <button className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
          {activeTab === 'swap' ? 'Swap Tokens' : 'Bridge Assets'}
        </button>

      </div>
    </div>
  );
}
