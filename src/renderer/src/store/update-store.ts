import { create } from 'zustand'

// 업데이트 상태 타입 정의
type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

// 업데이트 정보 타입 정의
interface UpdateInfo {
  version?: string
  releaseNotes?: string
  error?: string
  bytesPerSecond?: number
  transferred?: number
  total?: number
}

// 스토어의 상태와 액션 타입 정의
interface UpdateState {
  status: UpdateStatus
  info: UpdateInfo
  progress: number
  setStatus: (status: UpdateStatus, info?: UpdateInfo) => void
  setProgress: (progress: number) => void
  reset: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  info: {},
  progress: 0,
  setStatus: (status, info = {}) => set({ status, info, progress: status === 'downloading' ? 0 : 100 }),
  setProgress: (progress) => set({ progress }),
  reset: () => set({ status: 'idle', info: {}, progress: 0 })
}))
