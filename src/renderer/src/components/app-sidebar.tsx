import { Link, useLocation } from 'react-router-dom'
import { Bell, Info, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <Sidebar variant={'inset'}>
      <SidebarHeader className="flex items-center justify-center py-4">
        <h1 className="text-xl font-bold">업무 모니터</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath === '/' || currentPath === '/settings'}
            >
              <Link to="/settings">
                <Settings className="h-5 w-5" />
                <span>사용자 설정</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath === '/alerts'}
              data-tutorial="alerts-nav"
            >
              <Link to="/alerts">
                <Bell className="h-5 w-5" />
                <span>알림</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath === '/about'}
              data-tutorial="about-nav"
            >
              <Link to="/about">
                <Info className="h-5 w-5" />
                <span>프로그램 정보</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
