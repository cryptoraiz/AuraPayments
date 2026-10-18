import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { Toaster } from 'sonner'

export default function Layout({ children }) {
  return (
    <div className="bg-dark-bg text-dark-text flex flex-col relative w-full min-h-screen overflow-x-hidden">
      <Toaster position="bottom-right" theme="dark" richColors offset={{ bottom: '64px', right: '24px' }} closeButton />
      <div className="flex-none z-50 sticky top-0">
        <Navbar />
      </div>
      <main className="flex-1 relative z-10 w-full flex flex-col">
        {children}
      </main>
      <div className="flex-none z-40 mt-auto">
        <Footer />
      </div>
    </div>
  )
}
