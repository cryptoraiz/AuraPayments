import { useState, useEffect } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { v4 as uuidv4 } from 'uuid'
import CurrencySelect from '../ui/CurrencySelect'
import { savePaymentLink } from '../../utils/localStorage'
import { invoiceAPI } from '../../services/invoiceService'
import { toast } from 'sonner'
import WalletModal from '../ui/WalletModal'

export default function PaymentForm({ theme = 'modern' }) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  // State
  const [formData, setFormData] = useState({
    name: '',
    wallet: '',
    amount: '',
    currency: 'USDC',
    description: '',
  })
  const [generatedLink, setGeneratedLink] = useState('')
  const [generatedLinkId, setGeneratedLinkId] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  // Spotlight State
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const styles = {
    container: "relative bg-dark-card border border-dark-border rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden",
    textPrimary: "text-white",
    textSecondary: "text-dark-muted",
    inputBg: "bg-dark-bg border border-dark-border/50 text-white placeholder:text-transparent hover:border-dark-border focus:border-blue-500/50 transition-all",
    label: "text-dark-muted",
    icon: "text-dark-muted",
    spotlight: "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl overflow-hidden"
  }

  // Update wallet when connected
  useEffect(() => {
    if (isConnected && address) {
      setFormData(prev => ({ ...prev, wallet: address }))
    } else {
      setFormData(prev => ({ ...prev, wallet: '' }))
    }
  }, [isConnected, address])

  // Handle Spotlight
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  // Currency Mask Handler
  const handleAmountChange = (e) => {
    let value = e.target.value.replace(/\D/g, '')
    if (!value) {
      setFormData({ ...formData, amount: '' })
      return
    }
    const floatVal = parseInt(value, 10) / 100
    const formatted = floatVal.toFixed(2)
    setFormData({ ...formData, amount: formatted })
  }

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      const newId = uuidv4()
      const linkData = {
        id: newId,
        creatorAddress: address,
        ...formData,
        createdAt: Date.now(),
        status: 'pending'
      }

      // Save to backend FIRST (if it fails, do not save locally or show success)
      const backendPayload = {
        id: newId,
        fromWallet: address,
        toWallet: formData.wallet,
        recipientName: formData.name,
        amount: formData.amount,
        currency: formData.currency,
        description: formData.description
      }

      await invoiceAPI.create(backendPayload)

      // Only save locally if the API request succeeds
      savePaymentLink(linkData)

      // Generate Link
      const linkUrl = `${window.location.origin}/pay/${newId}`
      setGeneratedLink(linkUrl)
      setGeneratedLinkId(newId)

      // Notify other components (Navbar badge) to update immediately
      window.dispatchEvent(new Event('invoice_updated'));

      toast.success('Payment Link Created!')

    } catch (error) {
      console.error(error)
      // Differentiate between Wallet errors and Server errors if possible
      if (error.message && error.message.includes('HTTP error')) {
        toast.error('Server Unreachable: Could not save invoice online.')
      } else {
        toast.error('Error creating link: ' + (error.message || 'Unknown error'))
      }
    }
  }

  // Copy Handler without Toast
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="relative group" onMouseMove={handleMouseMove}>
      {/* Spotlight Effect - Modern Only */}
      <div
        className={styles.spotlight}
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.05), transparent 40%)`
        }}
      />

      {/* Card */}
      <div className={styles.container}>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6 transition-all duration-300">
          <span className="text-2xl">{generatedLink ? '✨' : '💎'}</span>
          <div>
            <h2 className={`text-xl font-bold ${styles.textPrimary}`}>{generatedLink ? 'Invoice Created!' : 'New Invoice'}</h2>
            <p className={`text-sm ${styles.textSecondary}`}>
              {generatedLink ? 'Payment link ready to share.' : 'Configure payment details'}
            </p>
          </div>
        </div>

        {!generatedLink ? (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-4 animate-[slideDown_0.3s_ease-out]">
            {/* Name */}
            <div className="input-group">
              <input
                type="text"
                className={`input-float py-3 text-sm ${styles.inputBg}`}
                placeholder=" "
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="off"
                spellCheck="false"
              />
              <label htmlFor="name" className={`label-float top-1/2 -translate-y-1/2 text-xs ${styles.label}`}>
                Name or Business
              </label>
            </div>

            {/* Wallet (Auto-filled & Read-only) */}
            <div className="input-group opacity-70 relative group/wallet">
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm ${styles.icon}`}>💼</span>
                <input
                  type="text"
                  className={`input-float pl-10 py-3 text-sm ${styles.inputBg} cursor-not-allowed`}
                  placeholder={!isConnected ? "Connect wallet to auto-fill..." : " "}
                  id="wallet"
                  value={formData.wallet}
                  readOnly
                  title={!isConnected ? "Connect wallet to auto-fill..." : "Your wallet address"}
                />
                {isConnected && (
                  <label htmlFor="wallet" className={`label-float top-1/2 -translate-y-1/2 text-xs ${styles.label}`} style={{ left: '40px' }}>
                    Your Wallet (Auto)
                  </label>
                )}
              </div>

              {/* Error/Validation Message */}
              {formData.wallet && !/^0x[a-fA-F0-9]{40}$/.test(formData.wallet) && (
                <div className="absolute -bottom-5 left-0 text-xs text-red-400 font-medium ml-4 flex items-center gap-1">
                  <span>⚠️ Invalid Address</span>
                  <span>({formData.wallet.length}/42 chars)</span>
                </div>
              )}
            </div>

            {/* Amount + Currency */}
            <div className="grid gap-3 items-start" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              {/* Amount */}
              <div className="input-group">
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg ${styles.icon}`}>
                    {getCurrencySymbol(formData.currency)}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`input-float pl-8 py-3 text-lg font-bold ${styles.inputBg}`}
                    placeholder=" "
                    id="amount"
                    value={formData.amount}
                    onChange={handleAmountChange}
                    required
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <label htmlFor="amount" className={`label-float top-1/2 -translate-y-1/2 text-xs ${styles.label}`} style={{ left: '32px' }}>
                    Enter amount
                  </label>
                </div>
              </div>

              {/* Currency - Custom Select */}
              <CurrencySelect
                value={formData.currency}
                onChange={(value) => setFormData({ ...formData, currency: value })}
                isClassic={false}
                isLight={false}
              />
            </div>

            {/* Fee Info */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
              <span className="text-green-400 font-bold text-sm">✓</span>
              <span className="text-sm text-green-400">Fee &lt; $0.01 • Instant</span>
            </div>

            {/* Description */}
            <div className="input-group">
              <textarea
                className={`input-float resize-none py-3 text-sm ${styles.inputBg}`}
                rows="2"
                placeholder=" "
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                autoComplete="off"
                spellCheck="false"
              ></textarea>
              <label htmlFor="description" className={`label-float top-3 text-xs ${styles.label}`}>
                Description (optional)
              </label>
            </div>

            {/* Submit / Connect Button */}
            <button
              type={isConnected ? "submit" : "button"}
              onClick={!isConnected ? (e) => {
                e.preventDefault();
                setIsWalletModalOpen(true);
              } : undefined}
              className={`relative overflow-hidden w-full px-6 py-4 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isConnected
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-[0_0_20px_rgba(39,117,202,0.3)] hover:shadow-[0_0_25px_rgba(39,117,202,0.5)]'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] shadow-lg'
                }`}
            >
              {isConnected ? (
                <>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_3s_infinite]"></span>
                  Create Invoice →
                </>
              ) : (
                <>
                  Connect Wallet
                </>
              )}
            </button>
          </form>
        ) : (
          /* SUCCESS VIEW */
          <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
            {/* Link Box */}
            <div className="p-1 rounded-2xl bg-gradient-to-r from-green-500/20 to-emerald-500/20">
              <div className="bg-slate-950/80 border-green-500/20 backdrop-blur-xl rounded-xl p-5 border text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-2xl animate-[bounce_1s_infinite]">
                  ✓
                </div>

                <div className="space-y-1">
                  <p className={`text-xs uppercase tracking-wider font-bold ${styles.label}`}>Payment Link</p>
                  <div className="flex items-center gap-2 rounded-lg p-2 border bg-black/40 border-white/5">
                    <span className="flex-1 text-sm font-mono truncate text-cyan-400">{generatedLink}</span>
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${isCopied
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                      {isCopied ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 20h6a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Share Options */}
            <div className="grid grid-cols-3 gap-3">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`ARC Connect Payment Link:\n${generatedLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-[#25D366]/5 border border-[#25D366]/20 hover:bg-[#25D366]/10 hover:scale-105 transition-all group/icon"
              >
                <div className="w-8 h-8 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center group-hover/icon:bg-[#25D366] group-hover/icon:text-black transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                </div>
                <span className="text-[10px] uppercase font-bold text-[#25D366]">WhatsApp</span>
              </a >
              {/* Telegram */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(generatedLink)}&text=${encodeURIComponent('ARC Connect Payment')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-[#0088cc]/5 border border-[#0088cc]/20 hover:bg-[#0088cc]/10 hover:scale-105 transition-all group/icon"
              >
                <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center group-hover/icon:bg-[#0088cc] group-hover/icon:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                </div>
                <span className="text-[10px] uppercase font-bold text-[#0088cc]">Telegram</span>
              </a>
              {/* Gmail */}
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('ARC Connect Receipt')}&body=${encodeURIComponent(`Here is your payment link via ARC Connect: ${generatedLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 hover:scale-105 transition-all group/icon"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center group-hover/icon:bg-red-500 group-hover/icon:text-white transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>
                </div>
                <span className="text-[10px] uppercase font-bold text-red-500">Gmail</span>
              </a>
            </div>

            {/* New Invoice Button */}
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  wallet: address || '', // Keep current wallet if connected
                  amount: '',
                  currency: 'USDC',
                  description: '',
                })
                setGeneratedLink('')
              }}
              className="w-full py-4 rounded-xl gradient-button text-white font-bold hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group shadow-lg"
            >
              <span className="text-xl">+</span>
              <span className="group-hover:translate-x-1 transition-transform">New Invoice</span>
            </button>
          </div>
        )}
      </div>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        connectors={connectors}
        onSelectWallet={(connector) => {
          connect({ connector })
          setIsWalletModalOpen(false)
        }}
      />
    </div>
  )
}

function getCurrencySymbol(currency) {
  if (currency === 'EURC') return '€'
  return '$'
}
