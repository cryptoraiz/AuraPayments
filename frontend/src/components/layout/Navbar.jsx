import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useInvoiceNotifications } from '../../hooks/useInvoiceNotifications'
import { useActiveArcChain } from '../../hooks/useActiveArcChain'
import { arcTestnet, arcMainnet } from '../../config/wagmi'
import { toast } from 'sonner'
import WalletModal from '../ui/WalletModal'

export default function Navbar() {
  const location = useLocation()
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { count: notificationCount } = useInvoiceNotifications()
  const { chainId, isMainnet, isTestnet, networkName, setWindowChainId, setNetworkMode, toggleNetworkMode, isWalletAligned } = useActiveArcChain()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const queryClient = useQueryClient()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Invalidate queries when wallet provider changes chains
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = () => {
        queryClient.invalidateQueries()
      }
      window.ethereum.on?.('chainChanged', handleChainChanged)
      return () => {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged)
      }
    }
  }, [queryClient])

  const handleWalletSelect = (connector) => {
    connect({ connector })
  }

  // Toggle between Arc Mainnet and Arc Testnet, or align wallet if misaligned
  const handleToggleNetwork = async () => {
    if (!isConnected) {
      toggleNetworkMode()
      return
    }

    // If wallet is not on the active network, switch wallet to current mode's Arc chain
    let targetChain
    if (!isWalletAligned) {
      targetChain = isMainnet ? arcMainnet : arcTestnet
    } else {
      // If already aligned, toggle to the other mode
      const nextMode = toggleNetworkMode()
      targetChain = nextMode === 'mainnet' ? arcMainnet : arcTestnet
    }

    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: targetChain.id })
      } else {
        await switchChain({ chainId: targetChain.id })
      }
      setWindowChainId?.(targetChain.id)
      queryClient.invalidateQueries()
    } catch (err) {
      if (err.code === 4001 || err.message?.includes('rejected')) {
        return
      }
      const success = await attemptRawSwitchTo(targetChain)
      if (success) {
        setWindowChainId?.(targetChain.id)
        queryClient.invalidateQueries()
      }
    }
  }

  // Raw Switch Implementation (Fallback)
  const attemptRawSwitchTo = async (targetChain) => {
    try {
      let provider = await connector?.getProvider()
      if (!provider && typeof window !== 'undefined' && window.ethereum) {
        provider = window.ethereum
      }
      if (!provider) throw new Error('No provider')

      const chainIdHex = `0x${targetChain.id.toString(16)}`
      const isTargetMainnet = targetChain.id === arcMainnet.id

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
        return true
      } catch (switchError) {
        if (
          switchError.code === 4902 || 
          switchError.data?.originalError?.code === 4902 ||
          switchError.message?.includes('4902') ||
          switchError.message?.includes('Unrecognized chain')
        ) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: isTargetMainnet ? 'Arc' : 'Arc Network Testnet',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
              rpcUrls: isTargetMainnet 
                ? ['https://5042.rpc.thirdweb.com', 'https://rpc.mainnet.arc.io'] 
                : ['https://rpc.testnet.arc.io', 'https://arc-testnet-rpc.publicnode.com', 'https://5042002.rpc.thirdweb.com'],
              blockExplorerUrls: isTargetMainnet ? ['https://explorer.arc.io'] : ['https://testnet.arcscan.app']
            }]
          })
          return true
        } else {
          throw switchError
        }
      }
    } catch (rawErr) {
      console.error("Raw Switch failed:", rawErr)
      if (!rawErr.message?.includes('rejected') && rawErr.code !== 4001) {
        toast.error(`Error switching to ${targetChain.id === arcMainnet.id ? 'Arc Mainnet' : 'Arc Testnet'}. Try manually in your wallet.`, { duration: 4000 })
      }
      return false
    }
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-dark-bg/90 border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5">
          <div className="flex items-center justify-between">
            {/* Logo + Links */}
            <div className="flex items-center gap-6 lg:gap-10">
              <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-sm group-hover:bg-blue-500/35 transition-all"></div>
                  <img
                    src="/aura-icon.svg"
                    alt="Aura Payments"
                    className="relative w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-blue-100 transition-colors">
                    Aura
                  </span>
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300">
                    Payments
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-5 lg:gap-8">
                <Link
                  to="/profile"
                  className={`text-sm font-medium transition ${isActive('/profile') ? 'text-white' : 'text-dark-muted hover:text-white'
                    } `}
                >
                  Portfolio
                </Link>
                <Link
                  to="/"
                  className={`text-sm font-medium transition ${isActive('/') ? 'text-white' : 'text-dark-muted hover:text-white'
                    } `}
                >
                  Trade
                </Link>
                <Link
                  to="/invoice"
                  className={`text-sm font-medium transition ${isActive('/invoice') ? 'text-white' : 'text-dark-muted hover:text-white'
                    } `}
                >
                  Invoice 2.0
                </Link>
                <Link
                  to="/aura-ai"
                  className={`text-sm font-medium transition flex items-center gap-1 ${isActive('/aura-ai') ? 'text-blue-400' : 'text-blue-500 hover:text-blue-400'
                    } `}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Aura AI
                </Link>
                {isTestnet && (
                  <Link
                    to="/faucet"
                    className={`text-sm font-medium transition ${isActive('/faucet') ? 'text-white' : 'text-dark-muted hover:text-white'
                      } `}
                  >
                    Faucet
                  </Link>
                )}
              </div>
            </div>

            {/* Right Buttons */}
            <div className="flex items-center gap-3">
              {/* Dynamic Network Badge & Toggle */}
              <button
                onClick={handleToggleNetwork}
                title={`Currently on ${isTestnet ? 'Arc Testnet' : 'Arc Mainnet'}. Click to switch to ${isTestnet ? 'Arc Mainnet' : 'Arc Testnet'}`}
                className={`px-2.5 sm:px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer group active:scale-95 ${
                  isTestnet
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400'
                    : 'bg-dark-card border-dark-border text-white hover:border-green-500/40 hover:bg-white/5'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isTestnet
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse'
                      : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                  }`}
                ></div>
                <span className="hidden sm:inline">{isTestnet ? 'Arc Testnet' : 'Arc Mainnet'}</span>
                <span className="sm:hidden">{isTestnet ? 'Testnet' : 'Mainnet'}</span>
                <svg
                  className="w-3 h-3 text-dark-muted group-hover:text-white transition-transform group-hover:rotate-180 duration-300 ml-0.5 opacity-70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>

              {/* Wallet Button */}
              {isConnected ? (
                <button
                  onClick={() => {
                    // Force disconnect all connectors to prevent auto-reconnect to another wallet
                    connectors.forEach(c => {
                      try {
                        disconnect({ connector: c })
                      } catch (e) {
                        console.error('Error disconnecting connector:', e)
                      }
                    })
                    // Ensure local state is cleared too (fallback)
                    disconnect()
                  }}
                  className="px-4 sm:px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm font-semibold hover:bg-white/10 transition"
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </button>
              ) : (
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="px-3 sm:px-6 py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm font-semibold hover:bg-blue-600/20 transition whitespace-nowrap"
                >
                  Connect Wallet
                </button>
              )}

              {/* Mobile Hamburger Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                className="md:hidden p-2 rounded-xl bg-dark-card border border-dark-border text-dark-muted hover:text-white transition-colors"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-dark-border/60 bg-dark-bg/95 backdrop-blur-2xl px-6 py-4 space-y-2 animate-[slideDown_0.2s_ease-out]">
            <Link
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                isActive('/profile') ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Portfolio
            </Link>
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                isActive('/') ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Trade
            </Link>
            <Link
              to="/invoice"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                isActive('/invoice') ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Invoice 2.0
            </Link>
            <Link
              to="/aura-ai"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                isActive('/aura-ai') ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Aura AI
            </Link>
            {isTestnet && (
              <Link
                to="/faucet"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2.5 px-3 rounded-xl text-sm font-semibold transition ${
                  isActive('/faucet') ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Faucet
              </Link>
            )}
            <div className="pt-3 border-t border-dark-border/40 flex items-center gap-4 px-3">
              <Link
                to="/how-it-works"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-xs text-dark-muted hover:text-white transition"
              >
                How It Works
              </Link>
              <Link
                to="/faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-xs text-dark-muted hover:text-white transition"
              >
                FAQ
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        connectors={connectors}
        onSelectWallet={handleWalletSelect}
      />
    </>
  )
}
