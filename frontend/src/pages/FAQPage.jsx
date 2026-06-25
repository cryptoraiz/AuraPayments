import { useState, useEffect, useRef } from 'react'
import FAQItem from '../components/ui/FAQItem'

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null)
  const faqContainerRef = useRef(null)

  const faqs = [
    {
      question: 'What is USDC/EURC?',
      answer: 'Stablecoins issued by Circle. 1 USDC = $1 USD and 1 EURC = €1 EUR. They maintain a stable 1:1 value with traditional currencies.'
    },
    {
      question: 'How much does Arc Invoice cost?',
      answer: 'Free to create links! You only pay the Arc network fee: ~$0.01 USDC (one tenth of a cent) per transaction. No monthly fees or hidden charges.'
    },
    {
      question: 'Do I need a crypto wallet?',
      answer: 'Yes, you need a Web3 wallet compatible with Arc Network (e.g., MetaMask, Rabby, Coinbase Wallet) to receive payments.'
    },
    {
      question: 'How does my client pay?',
      answer: 'The client can pay in 2 ways:\n\n• Desktop: Clicks the link and connects their wallet (MetaMask, Rabby, etc)\n\n• Mobile: Scans the QR Code with a mobile wallet app\n\nInstant confirmation in both cases!'
    },
    {
      question: 'Is it safe?',
      answer: 'Absolutely! Transactions are verified on-chain on the Arc Network. You have full control of your funds. No intermediaries, no custody.'
    },
    {
      question: 'Do payment links expire?',
      answer: 'Yes! For security, each link expires 5 minutes after creation (for testing). You can create new links at any time, for free and instantly.'
    },
    {
      question: 'Where do I see my activity?',
      answer: 'In the "Activity" tab, you see all created links, received and sent payments. You can download PDF receipts and clear data whenever you want.'
    },
    {
      question: 'How long does it take?',
      answer: 'Create link: ~5 seconds. Payment confirmed: < 1 second after client approval. It is instant!'
    },
    {
      question: 'Is there a value limit?',
      answer: 'There is no minimum or maximum limit imposed by Arc Invoice. Limits depend only on your wallet and client balance.'
    }
  ]

  // Close FAQ when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (faqContainerRef.current && !faqContainerRef.current.contains(event.target) && openIndex !== null) {
        setOpenIndex(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openIndex])

  return (
    <section className="flex-1 flex items-center justify-center p-4 md:p-6 h-full min-h-0">
      <div className="w-full max-w-6xl mx-auto space-y-6 h-full flex flex-col justify-center">
        {/* Hero Compacto */}
        <div className="relative text-center space-y-2 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px] pointer-events-none"></div>
          <h1 className="relative text-3xl md:text-4xl font-black">
            Questions? <span className="gradient-text">We answer here</span>
          </h1>
        </div>

        {/* FAQs in Single Column */}
        <div
          ref={faqContainerRef}
          className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent opacity-0 animate-[slideDown_0.5s_ease-out_0.2s_forwards] space-y-4 max-w-3xl mx-auto w-full"
          style={{ animationFillMode: 'forwards' }}
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        {/* Call to Action Compacto */}
        <div className="text-center py-3 border-t border-white/5 opacity-0 animate-[fadeIn_0.5s_ease-out_0.4s_forwards]" style={{ animationFillMode: 'forwards' }}>
          <p className="text-xs text-gray-400">
            Still have questions? Contact us via official channels.
          </p>
        </div>
      </div>
    </section>
  )
}
