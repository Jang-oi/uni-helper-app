import { HashRouter, Route, Routes } from 'react-router-dom'
import { SettingsPage } from '@/pages/settings-page'
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/theme-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'
import { SiteHeader } from './components/site-header'

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <HashRouter>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <main className="px-4 md:px-10 lg:px-20 py-6">
              <Routes>
                <Route path="/" element={<SettingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/*<Route path="/alerts" element={<AlertsPage />} />*/}
                {/*<Route path="/about" element={<AboutPage />} />*/}
              </Routes>
            </main>
          </SidebarInset>
          <Toaster position="top-right" richColors />
        </SidebarProvider>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
