
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { useInvoiceNotifications } from '../../hooks/useInvoiceNotifications'
import { arcTestnet, arcMainnet } from '../../config/wagmi'
import { toast } from 'sonner'
import WalletModal from '../ui/WalletModal'

export default function Navbar() {
  const location = useLocation()
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { count: notificationCount } = useInvoiceNotifications()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])
  const handleWalletSelect = (connector) => {
    connect({ connector })
  }

  // Handle network switch (Toggle between Arc Mainnet and Arc Testnet)
  const handleToggleNetwork = async () => {
    const targetChain = chainId === arcMainnet.id ? arcTestnet : arcMainnet
    try {
      await switchChain({ chainId: targetChain.id })
    } catch (err) {
      if (err.code === 4001 || err.message?.includes('rejected')) {
        return
      }
      await attemptRawSwitchTo(targetChain)
    }
  }

  // Raw Switch Implementation (Fallback)
  const attemptRawSwitchTo = async (targetChain) => {
    try {
      const provider = await connector?.getProvider()
      if (!provider) throw new Error('No provider')

      const chainIdHex = `0x${targetChain.id.toString(16)}`

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch (switchError) {
        if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
          const isMainnet = targetChain.id === arcMainnet.id
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: targetChain.name,
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
              rpcUrls: isMainnet ? ['https://rpc.mainnet.arc.io'] : ['https://rpc.testnet.arc.network'],
              blockExplorerUrls: isMainnet ? ['https://explorer.arc.io'] : ['https://testnet.arcscan.app']
            }]
          })
        } else {
          throw switchError
        }
      }
      return true
    } catch (rawErr) {
      console.error("Raw Switch failed:", rawErr)
      toast.error(`Error switching to ${targetChain.name}. Try manually in your wallet.`, { duration: 4000 })
      return false
    }
  }

  const attemptRawSwitch = () => attemptRawSwitchTo(arcMainnet)

  // Auto-switch with REAL chainId verification (bypass Rabby cache bug)
  useEffect(() => {
    if (!isConnected) {
      // console.log('❌ Not connected, skipping auto-switch')
      return
    }

    let mounted = true
    let pollAttempts = 0
    const maxPollAttempts = 30 // Poll for 15 seconds total
    let retryCount = 0
    const maxRetries = 2

    // Get REAL chainId from provider (bypass wagmi cache)
    const getRealChainId = async () => {
      try {
        let provider = null
        if (typeof connector?.getProvider === 'function') {
          provider = await connector.getProvider()
        } else if (connector?.provider) {
          provider = connector.provider
        } else if (typeof window !== 'undefined' && window.ethereum) {
          provider = window.ethereum
        }

        if (!provider || typeof provider.request !== 'function') return null

        const hexChainId = await provider.request({ method: 'eth_chainId' })
        const realChainId = parseInt(hexChainId, 16)
        return realChainId
      } catch (err) {
        return null
      }
    }

    // Poll for chainId if not immediately available
    const pollForChainId = async () => {
      if (!mounted) return

      // Get real chainId from provider
      const realChainId = await getRealChainId()

      if (!realChainId) {
        pollAttempts++
        if (pollAttempts < maxPollAttempts) {
          setTimeout(pollForChainId, 500)
        } else {
          console.error('❌ chainId not detected after 5s - possible wallet issue')
          // toast.error('Error detecting network. Try disconnecting and reconnecting.')
        }
        return
      }

      // chainId detected, check if switching is needed
      if (realChainId === arcTestnet.id || realChainId === arcMainnet.id) {
        return
      }

      // Different chainId detected, starting auto-switch...
      attemptSwitch()
    }

    const attemptSwitch = async () => {
      if (!mounted) return

      // Verify again before switching
      const realChainId = await getRealChainId()
      if (realChainId === arcTestnet.id || realChainId === arcMainnet.id) {
        // console.log('✅ Network already changed')
        return
      }

      // Auto-Switch started

      try {
        await switchChain({ chainId: arcMainnet.id })
        // console.log('✅ Auto-Switch successful!')
        // toast.success('Network switched successfully!')
      } catch (err) {
        console.warn(`⚠️ Auto - Switch Error(Attempt ${retryCount + 1}): `, err)

        // Ignore user rejection
        if (err.code === 4001 || err.message?.includes('rejected')) {
          // console.log('❌ User rejected network switch')
          return
        }

        // Fallback to Raw Switch on last attempt
        if (retryCount >= maxRetries) {
          // console.log("🔧 Trying Fallback Raw Switch...")
          const success = await attemptRawSwitch()
          if (!success) {
            toast.error('Could not switch to Arc Network. Please switch manually.', { duration: 5000 })
          }
        } else {
          retryCount++
          // console.log(`⏳ Waiting 1.5s for next attempt...`)
          setTimeout(attemptSwitch, 1500)
        }
      }
    }

    // Start polling
    pollForChainId()

    return () => {
      mounted = false
    }
  }, [isConnected, chainId, switchChain, connector])

  // Check if on correct network (Arc Mainnet or Arc Testnet)
  const isCorrectNetwork = chainId === arcTestnet.id || chainId === arcMainnet.id

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-dark-bg/90 border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Links */}
            <div className="flex items-center gap-12">
              <Link to="/" className="flex items-center gap-3 group">
                {/* Official Aura Logo Icon */}
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-xl bg-cyan-500/20 blur-md group-hover:bg-cyan-500/40 transition-all"></div>
                  <img
                    src="/aura-logo-icon-v2.svg"
                    alt="Aura Payments"
                    className="relative w-10 h-10 rounded-xl object-contain shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all"
                  />
                </div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xl font-bold tracking-tight text-white group-hover:text-cyan-100 transition-colors">
                    Aura
                  </span>
                  <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300">
                    Payments
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-8">
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
                {chainId !== arcMainnet.id && (
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
              {/* Interactive Network Switch Badge */}
              <button
                onClick={handleToggleNetwork}
                title={`Click to switch to ${chainId === arcMainnet.id ? 'Arc Testnet' : 'Arc Mainnet'}`}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 hover:border-blue-500/40 hover:bg-white/5 transition-all group cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="hidden sm:inline">{chainId === arcMainnet.id ? 'Arc Mainnet' : chainId === arcTestnet.id ? 'Arc Testnet' : 'Arc Network'}</span>
                <span className="sm:hidden">{chainId === arcMainnet.id ? 'Mainnet' : chainId === arcTestnet.id ? 'Testnet' : 'Arc'}</span>
                <svg className="w-3.5 h-3.5 text-dark-muted group-hover:text-blue-400 transition-colors ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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
            {chainId !== arcMainnet.id && (
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
