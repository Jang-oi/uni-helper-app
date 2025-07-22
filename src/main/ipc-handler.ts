import { app, ipcMain, BrowserWindow } from 'electron'
import Store from 'electron-store'

const SUPPORT_URL = 'https://114.unipost.co.kr/home.uni'
const store = new Store()
/**
 * 모든 IPC 통신 핸들러를 등록하는 함수
 * @param mainWindow 메인 BrowserWindow 인스턴스
 */
export function initializeIpcHandlers(mainWindow: BrowserWindow): void {
  // --- 핸들러 등록 ---
  // 'ipcMain.handle' 또는 'ipcMain.on'을 사용하여 렌더러의 요청을 처리합니다.

  // 설정 불러오기
  ipcMain.handle('get-settings', async () => {
    return store.get('settings')
  })

  // 설정 저장하기
  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      store.set('settings', settings)
      return { success: true }
    } catch (error) {
      // ...
      return { success: false, message: '오류 발생' }
    }
  })

  // 모니터링 상태 가져오기
  ipcMain.handle('get-monitoring-status', () => {
    // ... 기존 getMonitoringStatus 함수의 로직 ...
    return { isMonitoring: false /* ... */ }
  })

  // 앱 정보 가져오기
  ipcMain.handle('get-app-info', () => {
    return { version: app.getVersion() }
  })

  // 여기에 이전에 ipc-handler.js에 있던 모든 ipcMain.handle/on 코드를 옮겨옵니다.
  // (toggle-monitoring, open-request, check-for-updates 등)
}
