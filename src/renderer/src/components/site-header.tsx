import { useLocation } from 'react-router-dom'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function SiteHeader() {
  const { theme, setTheme } = useTheme()
  const location = useLocation()

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return '홈'
      case '/settings':
        return '사용자 설정'
      case '/alerts':
        return '알림'
      case '/about':
        return '프로그램 정보'
      case '/schedule':
        return '일정'
      default:
        return '업무 알림 시스템'
    }
  }

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>
  )
}
