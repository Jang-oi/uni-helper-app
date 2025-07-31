import { create } from 'zustand'

// 로그 데이터 타입
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
}

// Store의 상태(State)와 액션(Actions) 타입 정의
interface LogState {
  logs: LogEntry[]
  addLog: (log: LogEntry) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (log) =>
    set((state) => ({
      // .slice() 제한 로직 제거
      logs: [log, ...state.logs]
    })),
  clearLogs: () => set({ logs: [] })
}))
