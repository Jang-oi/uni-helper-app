import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { LoadingOverlay } from '@/components/loading-overlay'
import { SiteHeader } from '@/components/site-header'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AboutPage } from '@/pages/about-page'
import { AlertsPage } from '@/pages/alerts-page'
import { SettingsPage } from '@/pages/settings-page'

function App() {
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
              </Routes>
            </main>
          </SidebarInset>
          <Toaster position="top-right" richColors />
          <LoadingOverlay />
        </SidebarProvider>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
