import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import AppShell from '@/components/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'
import { TooltipProvider } from '@/components/ui'
import Dashboard from '@/pages/Dashboard'
import Rankings from '@/pages/Rankings'
import OpportunityDetail from '@/pages/OpportunityDetail'
import Scanner from '@/pages/Scanner'
import Method from '@/pages/Method'
import Sources from '@/pages/Sources'
import CalendarPage from '@/pages/Calendar'
import About from '@/pages/About'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="panel flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Compass className="h-8 w-8 text-amber" />
      <div className="text-[16px] font-semibold">页面不存在</div>
      <div className="font-mono text-[11px] text-dim">RADAR / 404 · route not found</div>
      <Link to="/" className="mt-1 inline-flex h-8 items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-3 text-[12px] text-signal">
        返回指挥台
      </Link>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <AppShell>
        <ScrollToTop />
        <motion.div
          key={location.pathname}
          initial={{ y: 5 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <ErrorBoundary>
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/opportunities/:id" element={<OpportunityDetail />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/method" element={<Method />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </motion.div>
      </AppShell>
    </TooltipProvider>
  )
}
