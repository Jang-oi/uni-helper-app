import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // 모니터링 및 설정 상태
  isMonitoring: boolean

  // 로딩 상태
  isLoading: boolean
  loadingMessage: string
  // 함수들
  setLoading: (isLoading: boolean, message?: string) => void
  setMonitoring: (isMonitoring: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isLoading: false,
      loadingMessage: '',
      isMonitoring: false,
      setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
      setMonitoring: (isMonitoring) => set({ isMonitoring })
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        // 영구 저장할 상태만 선택
        isMonitoring: state.isMonitoring
      })
    }
  )
)
