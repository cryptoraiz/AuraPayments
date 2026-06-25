import { useState } from 'react';
import { motion } from 'framer-motion';

export default function DeFiWidget({ defaultTab = 'swap' }) {
  const [activeTab, setActiveTab] = useState(defaultTab); // 'swap' or 'bridge'
  const [amount, setAmount] = useState('');

  return (
    <div className="w-full max-w-[480px] mx-auto">
      {/* Widget Container */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden">
        
        {/* Header Tabs - Segmented Control (Relay Style) */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-dark-input p-1 rounded-2xl border border-dark-border/50">
            <button
              onClick={() => setActiveTab('swap')}
              className={`relative px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
                activeTab === 'swap' 
                  ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
                  : 'text-dark-muted hover:text-gray-300'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab('bridge')}
              className={`relative px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${
                activeTab === 'bridge' 
                  ? 'text-white bg-dark-card shadow-lg shadow-black/20 ring-1 ring-white/10' 
                  : 'text-dark-muted hover:text-gray-300'
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
        <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 transition-all focus-within:border-blue-500/50 focus-within:bg-dark-input/50 focus-within:shadow-[0_0_15px_rgba(39,117,202,0.1)]">
          <div className="text-sm font-medium text-dark-muted mb-3">
            {activeTab === 'swap' ? 'You pay' : 'Bridge from'}
          </div>
          <div className="flex items-center justify-between gap-4">
            {/* Token Selector Pill */}
            <button className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 hover:scale-105 transition-all rounded-full py-1.5 px-3 shadow-lg">
              <div className="w-7 h-7 rounded-full bg-[#2775CA] flex items-center justify-center text-white shadow-inner overflow-hidden p-[1px]">
                <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=024" alt="USDC" className="w-full h-full object-contain rounded-full bg-white p-[1px]" />
              </div>
              <span className="font-bold text-white text-lg tracking-wide">USDC</span>
              <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Large Number Input */}
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-right text-4xl font-black text-white placeholder-dark-border outline-none tracking-tight"
            />
          </div>
          <div className="flex justify-end mt-2 text-sm text-dark-muted font-medium">
            $0.00
          </div>
        </div>

        {/* Switch Direction Button */}
        <div className="relative h-1 flex items-center justify-center z-10 my-2">
          <div className="absolute w-12 h-12 bg-dark-card border-[6px] border-dark-bg rounded-xl flex items-center justify-center text-dark-muted hover:text-white transition-all hover:bg-dark-border cursor-pointer shadow-lg hover:rotate-180 duration-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Input TO */}
        <div className="bg-dark-bg/80 border border-dark-border/60 hover:border-dark-border rounded-2xl p-5 transition-all">
          <div className="text-sm font-medium text-dark-muted mb-3">
            {activeTab === 'swap' ? 'You receive' : 'Bridge to'}
          </div>
          <div className="flex items-center justify-between gap-4">
            {/* Token Selector Pill */}
            <button className="flex items-center gap-2 bg-dark-card border border-dark-border hover:bg-dark-border/80 hover:scale-105 transition-all rounded-full py-1.5 px-3 shadow-lg">
              <div className="w-7 h-7 rounded-full bg-[#627EEA] flex items-center justify-center text-white shadow-inner overflow-hidden p-[1px]">
                <img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=024" alt="ETH" className="w-full h-full object-contain rounded-full bg-white p-[1px]" />
              </div>
              <span className="font-bold text-white text-lg tracking-wide">ETH</span>
              <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Large Number Output */}
            <input
              type="number"
              placeholder="0.0"
              disabled
              className="w-full bg-transparent text-right text-4xl font-black text-white placeholder-dark-border outline-none cursor-not-allowed tracking-tight"
            />
          </div>
          <div className="flex justify-end mt-2 text-sm text-dark-muted font-medium">
            $0.00
          </div>
        </div>

        {/* Main Action Button */}
        <button className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)] active:scale-[0.98]">
          {activeTab === 'swap' ? 'Swap Tokens' : 'Bridge Assets'}
        </button>

        {/* Pro Features / Details */}
        <div className="mt-4 flex items-center justify-between text-xs font-medium px-2 opacity-60">
          <div className="flex gap-4">
            <span className="text-dark-muted hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              Slippage: <span className="text-blue-400">0.5%</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>
            </span>
            <span className="text-dark-muted">Routing: <span className="text-white">Auto</span></span>
          </div>
          <span className="text-dark-muted flex items-center gap-1">
            Network Fee: <span className="text-green-400">~$0.01</span>
          </span>
        </div>
      </div>
    </div>
  );
}
