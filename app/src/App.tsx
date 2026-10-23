import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import AppShell from '@/components/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'
import { TooltipProvider } from '@/components/ui'
import Dashboard from '@/pages/Dashboard'
import Control from '@/pages/Control'
import Rankings from '@/pages/Rankings'
import Discover from '@/pages/Discover'
import OpportunityDetail from '@/pages/OpportunityDetail'
import Scanner from '@/pages/Scanner'
import Method from '@/pages/Method'
import Sources from '@/pages/Sources'
import CalendarPage from '@/pages/Calendar'
import Lab from '@/pages/Lab'
import Profile from '@/pages/Profile'
import Alerts from '@/pages/Alerts'
import Calibration from '@/pages/Calibration'
import Yearbook from '@/pages/Yearbook'
import DataPage from '@/pages/Data'
import About from '@/pages/About'
import { I18nProvider, useI18n } from '@/lib/i18n'

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

function AppRoutes() {
  const location = useLocation()
  // 消费语言状态：切换语言时让整棵页面树重新渲染（保留路由/筛选/画像等状态，不刷新）
  useI18n()
  return (
    <motion.div
      key={location.pathname}
      initial={{ y: 5 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <ErrorBoundary>
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/control" element={<Control />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/opportunities/:id" element={<OpportunityDetail />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/method" element={<Method />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/yearbook" element={<Yearbook />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </motion.div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <TooltipProvider delayDuration={150} skipDelayDuration={300}>
        <AppShell>
          <ScrollToTop />
          <AppRoutes />
        </AppShell>
      </TooltipProvider>
    </I18nProvider>
  )
}
