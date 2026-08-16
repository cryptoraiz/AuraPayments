import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import SwapPage from './pages/SwapPage'
import BridgePage from './pages/BridgePage'
import InvoicePage from './pages/InvoicePage'
import ArcAIPage from './pages/ArcAIPage'
import ProfilePage from './pages/ProfilePage'
import HowItWorksPage from './pages/HowItWorksPage'
import FAQPage from './pages/FAQPage'
import PayPage from './pages/PayPage'
import HistoryPage from './pages/HistoryPage'
import FaucetPage from './pages/FaucetPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/bridge" element={<BridgePage />} />
        <Route path="/invoice" element={<InvoicePage />} />
        <Route path="/aura-ai" element={<ArcAIPage />} />
        <Route path="/arc-ai" element={<ArcAIPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/activity" element={<HistoryPage />} />
        <Route path="/faucet" element={<FaucetPage />} />
        <Route path="/pay/:linkId" element={<PayPage />} />
      </Routes>
    </Layout>
  )
}

export default App
