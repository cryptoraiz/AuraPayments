import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'

// Import wallet icons locally
import metamaskIcon from '../../assets/wallet-icons/metamask.svg'
import rabbyIcon from '../../assets/wallet-icons/rabby.png'
import phantomIcon from '../../assets/wallet-icons/phantom.png'
import coinbaseIcon from '../../assets/wallet-icons/coinbase.png'
import rainbowIcon from '../../assets/wallet-icons/rainbow.png'
import backpackIcon from '../../assets/wallet-icons/backpack.png'
import walletconnectIcon from '../../assets/wallet-icons/walletconnect.svg'
import keplrIcon from '../../assets/wallet-icons/keplr.png'
import safeIcon from '../../assets/wallet-icons/safe.png'
import bitgetIcon from '../../assets/wallet-icons/bitget.png'
import okxIcon from '../../assets/wallet-icons/okx.png'
import braveIcon from '../../assets/wallet-icons/brave.svg'

export default function WalletModal({ isOpen, onClose, connectors, onSelectWallet }) {
    // Detect installed wallets by checking if connector is ready
    const installedWallets = connectors.filter(c => c.ready !== false && c.name !== 'Injected')

    // Official Wallet Icons - Local Assets (Never breaks!)
    const walletIcons = {
        'MetaMask': metamaskIcon,
        'WalletConnect': walletconnectIcon,
        'Rabby Wallet': rabbyIcon,
        'Rabby': rabbyIcon,
        'Phantom': phantomIcon,
        'Coinbase Wallet': coinbaseIcon,
        'Rainbow': rainbowIcon,
        'Backpack': backpackIcon,
        'Keplr': keplrIcon,
        'Safe': safeIcon,
        'Trust Wallet': 'https://avatars.githubusercontent.com/u/32179842?s=200&v=4', // Fallback URL
        'Trust': 'https://avatars.githubusercontent.com/u/32179842?s=200&v=4',
        'Brave Wallet': braveIcon,
        'Brave': braveIcon,
        'OKX Wallet': okxIcon,
        'Bitget Wallet': bitgetIcon,
        'BitKeep': bitgetIcon,
        'Injected': 'https://www.svgrepo.com/show/331309/ethereum.svg' // Fallback URL
    }

    const getWalletIcon = (connector) => {
        if (!connector) return walletIcons['Injected']

        // Check by Name (Direct)
        const name = connector.name
        if (walletIcons[name]) return walletIcons[name]

        // Check by ID (More reliable for some)
        const id = connector.id?.toLowerCase()
        if (id) {
            if (id.includes('rabby')) return walletIcons['Rabby Wallet']
            if (id.includes('phantom')) return walletIcons['Phantom']
            if (id.includes('backpack')) return walletIcons['Backpack']
            if (id.includes('rainbow')) return walletIcons['Rainbow']
            if (id.includes('metamask')) return walletIcons['MetaMask']
            if (id.includes('coinbase')) return walletIcons['Coinbase Wallet']
            if (id.includes('okx')) return walletIcons['OKX Wallet']
            if (id.includes('trust')) return walletIcons['Trust Wallet']
            if (id.includes('bitget') || id.includes('bitkeep')) return walletIcons['Bitget Wallet']
            if (id.includes('keplr')) return walletIcons['Keplr']
            if (id.includes('safe')) return walletIcons['Safe']
            if (id.includes('walletconnect')) return walletIcons['WalletConnect']
        }

        // Check by Name (Fuzzy)
        const lowerName = name.toLowerCase()
        if (lowerName.includes('rabby')) return walletIcons['Rabby Wallet']
        if (lowerName.includes('phantom')) return walletIcons['Phantom']
        if (lowerName.includes('backpack')) return walletIcons['Backpack']
        if (lowerName.includes('rainbow')) return walletIcons['Rainbow']
        if (lowerName.includes('metamask')) return walletIcons['MetaMask']
        if (lowerName.includes('coinbase')) return walletIcons['Coinbase Wallet']
        if (lowerName.includes('okx')) return walletIcons['OKX Wallet']
        if (lowerName.includes('trust')) return walletIcons['Trust Wallet']
        if (lowerName.includes('brave')) return walletIcons['Brave Wallet']
        if (lowerName.includes('bitget') || lowerName.includes('bitkeep')) return walletIcons['Bitget Wallet']
        if (lowerName.includes('keplr')) return walletIcons['Keplr']
        if (lowerName.includes('safe')) return walletIcons['Safe']
        if (lowerName.includes('walletconnect')) return walletIcons['WalletConnect']

        return walletIcons['Injected']
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 shadow-2xl transition-all">
                                <div className="grid md:grid-cols-5 gap-6">
                                    {/* Left: Wallet List */}
                                    <div className="md:col-span-3 p-6 border-r border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <Dialog.Title className="text-2xl font-bold">
                                                Connect a Wallet
                                            </Dialog.Title>
                                            <button onClick={onClose} className="md:hidden text-gray-400">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-6">
                                            Choose your preferred wallet
                                        </p>

                                        {/* Installed Wallets */}
                                        {installedWallets.length > 0 ? (
                                            <>
                                                <div className="mb-3">
                                                    <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                                                        Available
                                                    </h3>
                                                </div>
                                                <div className="space-y-2 mb-6">
                                                    {installedWallets.map((connector) => (
                                                        <button
                                                            key={connector.id}
                                                            onClick={() => {
                                                                onSelectWallet(connector)
                                                                onClose()
                                                            }}
                                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-blue-500/30 transition-all group"
                                                        >
                                                            <div className="w-8 h-8 flex items-center justify-center">
                                                                <img src={getWalletIcon(connector)} alt={connector.name} className="w-full h-full object-contain p-0.5" />
                                                            </div>
                                                            <div className="flex-1 text-left">
                                                                <div className="font-semibold text-sm text-white group-hover:text-blue-400 transition-colors">
                                                                    {connector.name}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Detected
                                                                </div>
                                                            </div>
                                                            <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-4 text-center text-gray-400 text-sm">
                                                No wallets detected. Please install a wallet extension.
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Educational Panel */}
                                    <div className="hidden md:block md:col-span-2 p-6 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
                                        <div className="h-full flex flex-col">
                                            <h3 className="text-lg font-bold mb-4">
                                                What is a Wallet?
                                            </h3>

                                            <div className="space-y-6 flex-1">
                                                <div className="flex gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xl">🏦</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-1">Your Digital Assets</h4>
                                                        <p className="text-xs text-gray-400">
                                                            Send, receive, and store your tokens and NFTs securely.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xl">🔑</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-1">Universal Login</h4>
                                                        <p className="text-xs text-gray-400">
                                                            No more passwords. Use your wallet to log in to any Web3 app.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center justify-center mt-8 p-4 bg-blue-500/10 rounded-xl border border-blue-500/10 text-center">
                                                    <p className="text-xs font-medium text-blue-300 mb-2">New to Crypto?</p>
                                                    <a
                                                        href="https://ethereum.org/wallets/"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors"
                                                    >
                                                        Get a Wallet
                                                    </a>
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-white/10 text-center">
                                                <a href="#" className="text-xs text-blue-400/50 hover:text-blue-400 transition-colors">
                                                    Learn more about wallets
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
