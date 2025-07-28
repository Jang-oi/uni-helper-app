import { join } from 'path'
import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import { uniIcon } from './index'

// --- 타입 정의 ---
interface Settings {
  username?: string
  password?: string
  checkInterval?: number
  enableNotifications?: boolean
  startAtLogin?: boolean
}

// 스크래핑된 원본 데이터 타입 (실제 데이터에 맞게 필드 추가/수정)
interface Alert extends Record<string, any> {
  SR_IDX: string
  REQ_TITLE: string
  CM_NAME: string
  STATUS: string
  WRITER: string
  REQ_DATE: string
  REQ_DATE_ALL: string
  PROCESS_DATE: string
}

// 상태 플래그가 추가된 알림 데이터 타입
interface AlertWithFlags extends Alert {
  isUrgent: boolean
  isDelayed: boolean
  isPending: boolean
}

const SUPPORT_URL = 'https://114.unipost.co.kr/home.uni'
const BUSINESS_HOURS_START = 7 // 오전 7시
const BUSINESS_HOURS_END = 20 // 오후 8시
const activeNotifications: { notification: any; srIdx: string; createdAt: number }[] = []

const store = new Store()
let mainWindow: BrowserWindow | null = null
let supportWindow: BrowserWindow | null = null
let isMonitoring = false
let monitoringInterval: NodeJS.Timeout | null = null
// 앱 세션 동안 수동 시작 여부를 추적하는 플래그
let isManualStartTriggeredInSession = false

/**
 * 업데이트 상태를 렌더러 프로세스로 전송하는 함수
 * @param status - 업데이트 상태 (예: 'checking', 'available')
 * @param data - 추가 정보 객체
 */
function sendUpdateStatus(status: string, data: Record<string, any> = {}) {
  mainWindow?.webContents.send('update-status', { status, ...data })
}

/**
 * electron-updater의 이벤트 리스너를 설정하는 함수
 */
function setupAutoUpdater() {
  autoUpdater.autoDownload = false // 자동 다운로드 비활성화
  autoUpdater.autoInstallOnAppQuit = true // 종료 시 자동 설치

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking')
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus('not-available', info)
  })

  autoUpdater.on('error', (err) => {
    sendUpdateStatus('error', { error: err.toString() })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    // 프론트엔드에서 'downloading' 상태를 사용하므로 맞춰서 전송
    sendUpdateStatus('downloading', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', info)
  })
}

/** 현재 시간이 업무 시간(평일 07:00 ~ 20:00)인지 확인 */
function isBusinessHours(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const day = now.getDay() // 0: 일요일, 6: 토요일
  if (day === 0 || day === 6) return false
  return hours >= BUSINESS_HOURS_START && hours < BUSINESS_HOURS_END
}

/** 서포트 열기 */
async function openUniPost(srIdx: string) {
  await shell.openExternal(`${SUPPORT_URL}?access=list&srIdx=${srIdx}`)
}

/** 로그인 확인 함수 */
async function ensureLoggedIn() {
  // 이미 로그인 상태면 바로 반환
  const checkLoginResult = await checkLoginSession()
  console.log(`ensureLoggedIn : checkLoginResult ${checkLoginResult.success} ${checkLoginResult.message}`)
  if (checkLoginResult.success) return checkLoginResult

  // 설정 확인
  const settings = store.get('settings', {}) as Settings
  if (!settings.username || !settings.password) return { success: false, message: '계정 정보가 설정되지 않았습니다.' }

  // 로그인 시도
  const { success, message } = await performLogin(settings.username, settings.password)

  return { success, message }
}

/** 로그인 수행 함수 */
async function performLogin(username, password) {
  try {
    // 로그인 페이지 확인 및 로그인 시도
    if (!supportWindow) return { success: false, message: 'Support window is not available.' }
    const loginResult = await supportWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const usernameField = document.querySelector("#userId");
          const passwordField = document.querySelector("#password");
          const loginButton = document.querySelector("body > div.wrap.login > div > div > div > div > form > fieldset > div.btn-area > button");

          if (!usernameField || !passwordField || !loginButton) return { success: false, message: "로그인 요소를 찾을 수 없습니다" };

          usernameField.value = "${username.replace(/"/g, '\\"')}";
          passwordField.value = "${password.replace(/"/g, '\\"')}";
          loginButton.click();

          return { success: true, message: "로그인 시도 완료" };
        } catch (error) {
          return { success: false, message: "로그인 스크립트 오류: " + error.message };
        }
      })();
    `)

    if (!loginResult.success) return loginResult

    // 로그인 성공 여부 확인 (대기 시간)
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 로그인 후 상태 확인
    return await checkLoginSession()
  } catch (error: any) {
    return { success: false, message: error.toString() }
  }
}

/** 로그인 확인 함수 */
async function checkLoginSession() {
  try {
    if (!supportWindow) return { success: false, message: 'Support window is not available.' }
    return await supportWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // 에러 메시지 확인
            const errorEl = document.querySelector('.up-alarm-box .up-alarm-message');
            if (errorEl && getComputedStyle(document.querySelector("#up-alarm")).display === "block") return { success: false, message: errorEl.textContent.trim() || "로그인 실패" };

            // 요청내역관리 탭 확인
            const li = document.querySelector('li[title="요청내역관리"], li[name="요청내역관리"]');
            if (!li) return { success: false, message: "로그인 후 요청내역관리 탭을 찾을 수 없습니다" };

            const tabId = li.getAttribute('aria-controls');
            const iframe = document.getElementById(tabId);

            if (!iframe || !iframe.contentWindow) return { success: false, message: "iframe을 찾을 수 없습니다" };

            return { success: true, message: "로그인 성공" };
          } catch (error) {
            return { success: false, message: "상태 확인 오류: " + error.message };
          }
        })();
      `)
  } catch (error: any) {
    return { success: false, message: '로그인 확인 중 오류: ' + error.toString() }
  }
}

/**
 * 시스템 알림을 표시하는 함수
 * @param {Array} alerts - 표시할 알림 목록
 */
function displayNotifications(alerts: AlertWithFlags[]) {
  const settings = store.get('settings', {}) as Settings
  // 알림이 비활성화되어 있으면 표시하지 않음
  if (!settings.enableNotifications) return

  // 오래된 알림 참조 정리 (2분 이상 지난 알림)
  const now = Date.now()
  const twoMinutesInMs = 2 * 60 * 1000

  // 오래된 알림 필터링하여 제거
  while (activeNotifications.length > 0 && now - activeNotifications[0].createdAt > twoMinutesInMs) activeNotifications.shift()

  alerts.forEach((alert) => {
    const notification = new Notification({
      title: `${alert.CM_NAME}`,
      body: `${alert.REQ_TITLE}\n상태: ${alert.STATUS}\n`,
      icon: uniIcon
    })
    // 생성 시간과 참조하는 SR_IDX 저장
    const notificationObj = {
      notification: notification,
      srIdx: alert.SR_IDX,
      createdAt: Date.now()
    }

    notification.on('click', async () => {
      await openUniPost(alert.SR_IDX)
      if (mainWindow && process.platform === 'win32') mainWindow.flashFrame(false)
    })
    // 알림 표시
    notification.show()

    // 활성 알림 배열에 추가
    activeNotifications.push(notificationObj)
  })

  // Windows에서만 작업 표시줄 아이콘 깜빡임 시작
  if (mainWindow && alerts.length > 0 && process.platform === 'win32') mainWindow.flashFrame(true)

  // 알림 객체 정리를 위한 타이머 설정 (30초 후)
  setTimeout(() => {
    // 현재 시간 기준으로 활성 상태인 알림 확인
    const currentTime = Date.now()

    // 활성 알림 배열에서 제거할 항목 인덱스 찾기
    const removeIndices: number[] = []
    activeNotifications.forEach((item, index) => {
      // 30초 이상 지났거나 이미 파괴된 알림 객체 식별
      const isExpired = currentTime - item.createdAt > 30000
      const isDestroyed = item.notification && item.notification.isDestroyed && item.notification.isDestroyed()

      if (isExpired || isDestroyed) removeIndices.unshift(index) // 역순으로 인덱스 추가 (제거 시 인덱스 변화 방지)
    })

    // 식별된 항목 제거
    removeIndices.forEach((index) => {
      activeNotifications.splice(index, 1)
    })
  }, 30000)
}

/**
 * 요청 데이터 형식화 함수
 * @param {Object} item - 원본 요청 항목
 * @returns {Object} - 형식화된 요청 항목
 */
function formatRequestData(item: Alert) {
  return {
    SR_IDX: item['SR_IDX'],
    REQ_TITLE: item['REQ_TITLE'],
    CM_NAME: item['CM_NAME'],
    STATUS: item['STATUS'],
    WRITER: item['WRITER'],
    REQ_DATE: item['REQ_DATE'],
    REQ_DATE_ALL: item['REQ_DATE_ALL'],
    PROCESS_DATE: item['PROCESS_DATE']
  }
}

/**
 * 각 알림 항목에 상태 플래그를 추가하는 함수
 * @param {Object} alert - 알림 항목
 * @returns {Object} - 플래그가 추가된 알림 항목
 */
/** 알림 항목에 상태 플래그 추가 */
function addStatusFlags(alert: Alert): AlertWithFlags {
  const isUrgent = !!(alert.REQ_TITLE && alert.REQ_TITLE.includes('긴급'))

  let isDelayed = false
  if (alert.PROCESS_DATE) {
    const processTime = new Date(alert.PROCESS_DATE).getTime()
    const todayTime = new Date().getTime()
    const weekInMs = 7 * 24 * 60 * 60 * 1000
    isDelayed = todayTime - processTime > weekInMs
  }

  let isPending = false
  if (alert.STATUS.includes('접수') && alert.REQ_DATE_ALL) {
    const reqTime = new Date(alert.REQ_DATE_ALL).getTime()
    const currentTime = new Date().getTime()
    const hourInMs = 60 * 60 * 1000
    isPending = currentTime - reqTime > hourInMs
  }

  return { ...alert, isUrgent, isDelayed, isPending }
}

/** 새 요청 사항 확인 */
async function checkForNewRequests(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const nowString = new Date().toLocaleString()
    const result = await scrapeDataFromSite()
    store.set('lastChecked', nowString)

    if (!result.success || !result.allRequests) return { success: false, message: result.message }

    const { allRequests, personalRequests } = result
    const existingAlerts = (store.get('alerts') || []) as AlertWithFlags[]
    const formattedAllRequests = allRequests.map(formatRequestData)

    const newAlerts = formattedAllRequests.filter((newAlert) => !existingAlerts.some((existing) => existing.SR_IDX === newAlert.SR_IDX))
    const statusChangedAlerts = formattedAllRequests.filter((newAlert) => {
      const existing = existingAlerts.find((e) => e.SR_IDX === newAlert.SR_IDX)
      return existing && existing.STATUS !== newAlert.STATUS && newAlert.STATUS === '고객사답변'
    })

    const alertsWithFlags = formattedAllRequests.map(addStatusFlags)
    const personalRequestsWithFlags = personalRequests?.map(formatRequestData).map(addStatusFlags) || []

    store.set('alerts', alertsWithFlags)
    store.set('personalRequests', personalRequestsWithFlags)

    mainWindow?.webContents.send('new-alerts-available')

    if (existingAlerts.length > 0) displayNotifications(newAlerts.map(addStatusFlags))
    displayNotifications(statusChangedAlerts.map(addStatusFlags))

    const message = `${alertsWithFlags.length}개 항목 업데이트 (${newAlerts.length}개 신규, ${statusChangedAlerts.length}개 고객사답변 상태 변경)`
    return { success: true, message }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('모니터링 중 오류:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// 데이터 스크래핑 함수
async function scrapeDataFromSite() {
  try {
    // iframe 내 데이터 스크래핑
    if (!supportWindow) return { success: false, message: 'Support window is not available.' }
    const result = await supportWindow.webContents.executeJavaScript(`
      (async function() {
        function waitForLoadingToFinish(iframeDoc) {
          return new Promise((resolve) => {
            const loadingArea = iframeDoc.querySelector('.loading-area');
            if (!loadingArea) {
              resolve(); // 로딩 표시가 없으면 즉시 완료
              return;
            }

            const checkDisplay = () => {
              const style = window.getComputedStyle(loadingArea);
              if (style.display === 'none') {
                clearInterval(interval);
                resolve();
              }
            };

            const interval = setInterval(checkDisplay, 100);
            checkDisplay();
          });
        }

        try {
          const li = document.querySelector('li[title="요청내역관리"], li[name="요청내역관리"]');
          if (!li) return { success: false, message: "요청내역관리 탭을 찾을 수 없습니다" };

          const tabId = li.getAttribute('aria-controls');
          const iframe = document.getElementById(tabId);
          if (!iframe || !iframe.contentWindow) return { success: false, message: "iframe을 찾을 수 없습니다" };

          await waitForLoadingToFinish(iframe.contentDocument);
          iframe.contentWindow.UNIUX.SVC('PROGRESSION_TYPE', 'R,E,O,A,C,N,M');
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_SEARCH_TYPE', 'A');
          iframe.contentWindow.UNIUX.SVC('START_DATE',new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]);

          iframe.contentDocument.querySelector('#doSearch').click();

          await waitForLoadingToFinish(iframe.contentDocument);

          const grid = iframe.contentWindow.grid;
          const allRequestsData = grid.getAllRowValue();

          const currentUsername = document.querySelector('.userNm').textContent.trim();
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_SEARCH_TYPE', 'P');
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_TEXT', currentUsername);

          iframe.contentDocument.querySelector('#doSearch').click();
          await waitForLoadingToFinish(iframe.contentDocument);
          const personalRequestsData = grid.getAllRowValue();

           return { success: true, allRequestsData, personalRequestsData };
        } catch (error) {
          return { success: false, message: "데이터 스크래핑 오류: " + error.message };
        }
      })();
    `)

    if (result.success) {
      return { success: true, allRequests: result.allRequestsData, personalRequests: result.personalRequestsData }
    } else {
      console.error('데이터 스크래핑 실패:', result.message)
      return { success: false, message: result.message, allRequests: [], personalRequests: [] }
    }
  } catch (error: any) {
    console.error('데이터 스크래핑 중 오류:', error)
    return { success: false, message: error.toString(), allRequests: [], personalRequests: [] }
  }
}

/** 모니터링 시작 함수 */
async function startMonitoring(): Promise<{ success: boolean; message: string }> {
  if (isMonitoring) {
    console.log('[Core] 이미 모니터링이 실행 중이므로 시작 요청을 건너뜁니다.')
    return { success: true, message: '이미 모니터링 중입니다.' }
  }

  const settings = store.get('settings', {}) as Settings
  if (!settings.username || !settings.password) return { success: false, message: '계정 정보가 설정되지 않았습니다.' }

  const loginResult = await ensureLoggedIn()
  if (!loginResult.success) return { success: false, message: loginResult.message }

  isMonitoring = true // 상태를 먼저 변경
  if (mainWindow) mainWindow.webContents.send('monitoring-status-changed', { isMonitoring: true })
  console.log('[Core] 모니터링이 시작되었습니다.')

  await checkForNewRequests() // 최초 1회 실행
  const intervalMs = (settings.checkInterval || 5) * 60 * 1000
  monitoringInterval = setInterval(checkForNewRequests, intervalMs)

  return { success: true, message: '모니터링을 시작합니다.' }
}

/** 모니터링 중지 함수 */
function stopMonitoring(isAutoPause = false): { success: boolean; message: string } {
  if (!isMonitoring) return { success: true, message: '이미 모니터링이 중지되었습니다.' }

  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
  isMonitoring = false

  // 사용자가 직접 중지했을 때만 환경설정 값을 변경
  if (!isAutoPause) {
    store.set('userMonitoringPref', 'off')
    console.log('[Manual Stop] 사용자가 모니터링을 중지했습니다.')
  } else {
    console.log('[Auto Pause] 시스템이 모니터링을 자동 중지했습니다.')
  }

  if (mainWindow) mainWindow.webContents.send('monitoring-status-changed', { isMonitoring: false })
  return { success: true, message: '모니터링이 중지되었습니다.' }
}

function getKoreanFormattedDateTime() {
  const now = new Date()

  // UTC 시간 기준 +9시간 더해서 한국 시간으로 조정
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  const year = koreaTime.getUTCFullYear()
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0')
  const date = String(koreaTime.getUTCDate()).padStart(2, '0')
  const hours = String(koreaTime.getUTCHours()).padStart(2, '0')
  const minutes = String(koreaTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(koreaTime.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`
}

/** 앱의 전체 상태를 주기적으로 확인하고 모니터링 상태를 조절하는 루프 */
function stateCheckLoop() {
  // 수동 시작이 한 번도 없었다면, 자동 시작 로직을 실행하지 않음
  const userWantsMonitoring = store.get('userMonitoringPref') === 'on'
  const withinHours = isBusinessHours()
  if (!isManualStartTriggeredInSession) {
    // 단, 업무 시간 외에 앱이 켜졌을 때 자동 중지는 필요할 수 있으므로 해당 로직은 유지
    if (isMonitoring && !withinHours) {
      console.log('[State Check] 업무 시간이 아니므로 모니터링을 중지합니다.')
      console.log(getKoreanFormattedDateTime())
      stopMonitoring(true)
    }
    return
  }

  if (userWantsMonitoring && withinHours && !isMonitoring) {
    console.log('[State Check] 업무 시간이 되어 모니터링을 자동으로 시작합니다.')
    console.log(getKoreanFormattedDateTime())
    startMonitoring()
  } else if (isMonitoring && !withinHours) {
    console.log('[State Check] 업무 시간이 종료되어 모니터링을 자동으로 중지합니다.')
    console.log(getKoreanFormattedDateTime())
    stopMonitoring(true)
  }
}

/**
 * 모든 IPC 통신 핸들러를 등록하는 함수
 */
export function initializeIpcHandlers(win: BrowserWindow): void {
  mainWindow = win
  supportWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  supportWindow.loadURL(SUPPORT_URL)
  setupAutoUpdater()

  // 설정 불러오기
  ipcMain.handle('get-settings', async () => {
    return store.get('settings', {}) as Settings
  })

  // 설정 저장하기
  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      store.set('settings', settings)
      return { success: true }
    } catch (error) {
      return { success: false, message: '오류 발생' }
    }
  })

  // 개별 설정 저장하기
  ipcMain.handle('update-single-setting', async (_event, key, value) => {
    try {
      store.set(`settings.${key}`, value)
      return { success: true }
    } catch (error) {
      return { success: false, message: '오류 발생' }
    }
  })

  // --- 모니터링 관련 핸들러 ---
  ipcMain.handle('toggle-monitoring', async (_event, shouldStart: boolean) => {
    if (shouldStart) {
      isManualStartTriggeredInSession = true
      store.set('userMonitoringPref', 'on')
      return startMonitoring()
    } else {
      return stopMonitoring(false)
    }
  })

  ipcMain.handle('get-alerts', async (_event) => {
    try {
      // 저장된 모든 알림 가져오기
      const allAlerts = store.get('alerts') || []
      const personalRequests = store.get('personalRequests') || []
      // 마지막 확인 시간
      const lastChecked = store.get('lastChecked') || null

      return { success: true, alerts: allAlerts, personalRequests, lastChecked }
    } catch (error: any) {
      console.error('알림 목록 조회 중 오류:', error)
      return { success: false, error: error.toString() }
    }
  })

  ipcMain.handle('open-request', async (_event, srIdx: string) => {
    try {
      await openUniPost(srIdx)
      return { success: true }
    } catch (error) {
      return { success: false, message: '서포트 페이지 열기 중 오류가 발생했습니다.' }
    }
  })

  // 앱 정보 핸들러
  ipcMain.handle('get-app-info', () => {
    return { version: app.getVersion() }
  })

  // --- 추가된 부분: 업데이트 관련 핸들러 ---
  ipcMain.handle('check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error: any) {
      sendUpdateStatus('error', { error: error.toString() })
      return { success: false, message: error.toString() }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      return { success: false, message: error.toString() }
    }
  })

  ipcMain.handle('install-update', () => {
    try {
      autoUpdater.quitAndInstall(false, true) // 앱 종료 후 업데이트 설치
      return { success: true }
    } catch (error: any) {
      return { success: false, message: error.toString() }
    }
  })

  setInterval(stateCheckLoop, 5 * 60 * 1000) // 5분 간격으로 상태 체크
}
