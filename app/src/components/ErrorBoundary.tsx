import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OpportunityRadar] 页面渲染异常：', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber" />
          <div className="text-[15px] font-semibold text-ink">当前页面渲染异常，已降级保护</div>
          <div className="max-w-[560px] font-mono text-[11px] leading-relaxed text-dim">
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              重新加载
            </Button>
            <Button variant="outline" onClick={() => (window.location.hash = '#/')}>
              返回指挥台
            </Button>
          </div>
          <div className="mt-1 text-[11px] text-muted">数据缺失不会导致白屏；若持续出现，请检查 data/ 数据或重新构建。</div>
        </div>
      )
    }
    return this.props.children
  }
}
