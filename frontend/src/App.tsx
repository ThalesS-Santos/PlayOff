import { AnimatePresence, MotionConfig } from 'motion/react'
import { BrowserRouter, matchPath, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from './components/Layout'
import { useBrandHue } from './components/useBrandHue'
import { Toaster } from './components/ui'
import { useStore } from './lib/store'
import { StoreProvider } from './lib/StoreProvider'
import Catalog from './pages/Catalog'
import CreateTournament from './pages/CreateTournament'
import Dashboard from './pages/Dashboard'
import Identity from './pages/Identity'
import Login from './pages/Login'
import TournamentPage from './pages/TournamentPage'

export function Shell() {
  const location = useLocation()
  const { user, orgs, get, orgOf } = useStore()

  // Cada torneio exibe a identidade visual da sua organização (RF06)
  const tMatch = matchPath('/torneios/:id', location.pathname)
  const t = tMatch ? get(tMatch.params.id ?? '') : undefined
  const hue = t ? orgOf(t).hue : (orgs.find((o) => o.id === user?.orgId) ?? orgs[0]).hue
  useBrandHue(hue)

  if (!user) return location.pathname === '/' ? <Login /> : <Navigate to="/" replace />

  const isOrg = user.role === 'organizador'
  return (
    <div className="app-glow min-h-screen">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/torneios" replace />} />
          <Route path="/torneios" element={<Catalog />} />
          <Route path="/favoritos" element={<Catalog favoritesOnly />} />
          <Route path="/torneios/:id" element={<TournamentPage />} />
          <Route path="/criar" element={isOrg ? <CreateTournament /> : <Navigate to="/torneios" replace />} />
          <Route path="/painel" element={isOrg ? <Dashboard /> : <Navigate to="/torneios" replace />} />
          <Route path="/identidade" element={isOrg ? <Identity /> : <Navigate to="/torneios" replace />} />
          <Route path="*" element={<Navigate to="/torneios" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <BrowserRouter>
          <Shell />
          <Toaster />
        </BrowserRouter>
      </StoreProvider>
    </MotionConfig>
  )
}
