import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { Toaster } from 'sonner'

export default function Layout({ children }) {
  return (
    <div className="bg-dark-bg text-dark-text flex flex-col relative w-full h-[100dvh] overflow-hidden">
      <Toaster position="bottom-right" theme="dark" richColors offset={{ bottom: '64px', right: '24px' }} closeButton />
      <div className="flex-none z-50">
        <Navbar />
      </div>
      <main className="flex-1 relative z-10 w-full flex flex-col min-h-0">
        {children}
      </main>
      <div className="flex-none z-40">
        <Footer />
      </div>
    </div>
  )
}
