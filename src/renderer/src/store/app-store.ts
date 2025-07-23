import { create } from 'zustand'

interface AppState {
  isMonitoring: boolean
  isLoading: boolean
  loadingMessage: string
  setLoading: (isLoading: boolean, message?: string) => void
  setMonitoring: (isMonitoring: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // 초기 상태 값
  isLoading: false,
  loadingMessage: '',
  isMonitoring: false,
  // 상태를 변경하는 함수들
  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
  setMonitoring: (isMonitoring) => set({ isMonitoring })
}))

window.electron.ipcRenderer.on('monitoring-status-changed', (_event, { isMonitoring }: { isMonitoring: boolean }) => {
  useAppStore.getState().setMonitoring(isMonitoring)
})
