import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAlertDialogStore } from '@/store/alert-dialog-store'
import { useUpdateStore } from '@/store/update-store'

export function UpdateNotifier() {
  const { status, info, setStatus } = useUpdateStore()
  const { openConfirm } = useAlertDialogStore()

  // IPC 이벤트 리스너 등록
  useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on('update-status', (_event, data: any) => {
      console.log('Received update status from main:', data) // 디버깅용 로그
      const { status, ...info } = data

      if (status === 'error') toast.error('업데이트 오류', { description: info.error || '알 수 없는 오류가 발생했습니다.' })

      setStatus(status, info)
    })

    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [setStatus])

  // 업데이트 다운로드 완료 시 확인 다이얼로그 표시
  useEffect(() => {
    if (status === 'downloaded') {
      openConfirm({
        title: '업데이트 설치',
        description: `버전 ${info.version}이(가) 다운로드되었습니다. 지금 설치하시겠습니까?\n설치를 위해 프로그램이 재시작됩니다.`,
        confirmText: '지금 설치',
        cancelText: '나중에',
        onConfirm: async () => {
          try {
            await window.electron.ipcRenderer.invoke('install-update')
          } catch (error) {
            toast.error('업데이트 설치 오류', { description: String(error) })
          }
        }
      })
    }
  }, [status, info.version, openConfirm])

  return null
}
