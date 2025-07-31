import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { LoadingOverlay } from '@/components/loading-overlay'
import { ScheduleAddDialog } from '@/components/schedule-add-dialog'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { UniAlertDialog } from '@/components/uni-alert-dialog'
import { AboutPage } from '@/pages/about-page'
import { AlertsPage } from '@/pages/alerts-page'
import { SchedulePage } from '@/pages/schedule-page'
import { SettingsPage } from '@/pages/settings-page'
import { useLogStore } from '@/store/log-store'

function App() {
  useEffect(() => {
    const handleNewLog = (_event: any, log: any) => {
      useLogStore.getState().addLog(log)
    }

    window.electron.ipcRenderer.on('new-log', handleNewLog)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('new-log')
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <HashRouter>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <main className="px-6 py-6">
              <Routes>
                <Route path="/" element={<SettingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
              </Routes>
            </main>
          </SidebarInset>
          <Toaster position="top-right" richColors />
          <LoadingOverlay />
          <UniAlertDialog />
          <ScheduleAddDialog />
        </SidebarProvider>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
