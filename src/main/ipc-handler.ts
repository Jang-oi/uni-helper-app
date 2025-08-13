import { join } from 'path'
import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import * as nodemailer from 'nodemailer'
import pino from 'pino'
import { uniIcon } from './index'

// --- 타입 정의 ---
interface Settings {
  username?: string
  password?: string
  checkInterval?: number
  enableNotifications?: boolean
  startAtLogin?: boolean
  notificationEmail?: boolean
}

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

interface AlertWithFlags extends Alert {
  isUrgent: boolean
  isDelayed: boolean
  isPending: boolean
}

interface Schedule {
  id: string
  srIdx: string
  title: string
  description: string
  date: string
  time: string
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
  requestTitle?: string
  notificationSent?: boolean
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const transporter = nodemailer.createTransport({
  host: '192.168.11.17',
  port: 25,
  secure: false
})

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      colorize: true
    }
  }
})

let mainWindow: BrowserWindow | null = null

function logAndSend(level: LogLevel, message: string, data?: object) {
  if (data) logger[level](data, message)
  else logger[level](message)
  mainWindow?.webContents.send('new-log', { level, message, timestamp: new Date().toISOString() })
}

const SUPPORT_URL = 'https://114.unipost.co.kr/home.uni'
const BUSINESS_HOURS_START = 7
const BUSINESS_HOURS_END = 20
const activeNotifications: { notification: any; srIdx: string; createdAt: number }[] = []

const store = new Store()
let supportWindow: BrowserWindow | null = null
let isMonitoring = false
let monitoringInterval: NodeJS.Timeout | null = null
let isManualStartTriggeredInSession = false

async function sendNotificationEmail(schedule: Schedule) {
  const settings = store.get('settings', {}) as Settings
  const recipientEmail = settings.notificationEmail

  if (!recipientEmail) {
    logAndSend('warn', '[이메일 알림] 건너뜀 - 알림 받을 이메일 주소가 미설정되었습니다.')
    return
  }

  try {
    await transporter.sendMail({
      from: '"일정 알리미" <uni-helper@unidocu.unipost.co.kr>',
      to: recipientEmail,
      subject: `[일정 알림] "${schedule.title}" 일정 시간이 1시간 남았습니다.`,
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', Dotum, '돋움', sans-serif; max-width: 600px; margin: 40px auto; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="background-color: #f7faff; padding: 25px; border-bottom: 1px solid #e0e0e0; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="font-size: 26px; color: #0056b3; margin: 0; font-weight: 700;">🚀 일정 예정 알림</h1></div>
          <div style="padding: 25px 30px;">
            <p style="font-size: 16px; color: #333; line-height: 1.6;">잠시 후 아래 내용의 일정 작업이 예정되어 있습니다.<br>잊지 않도록 미리 준비해 주세요.</p>
            <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;"><tbody>
                <tr><td style="padding: 10px; width: 90px; color: #888;">일정 내용</td><td style="padding: 10px; color: #333; font-weight: 600;">${schedule.title}</td></tr>
                <tr><td style="padding: 10px; color: #888;">일정 시간</td><td style="padding: 10px; color: #333; font-weight: 600;">${schedule.date} ${schedule.time}</td></tr>
                <tr><td style="padding: 10px; color: #888;">참고 사항</td><td style="padding: 10px; color: #333;">${schedule.description || '없음'}</td></tr>
              </tbody></table>
            </div>
            ${schedule.srIdx ? `<div style="text-align: center; margin-top: 30px;"><a href="${SUPPORT_URL}?access=list&srIdx=${schedule.srIdx}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 16px; font-weight: bold; color: #ffffff; background-color: #007bff; border-radius: 5px; text-decoration: none;">일정내용 확인하기</a></div>` : ''}
          </div>
          <div style="text-align: center; padding: 20px; border-top: 1px solid #e0e0e0; background-color: #f7faff; border-radius: 0 0 10px 10px;"><p style="font-size: 12px; color: #aaa; margin: 0;">본 메일은 Uni Helper에서 자동으로 발송되었습니다.</p></div>
        </div>
      `
    })

    logAndSend('info', `[이메일 알림] 발송 성공 (일정 ID: ${schedule.id}, 제목: ${schedule.title})`)

    const schedules = store.get('schedules', []) as Schedule[]
    const scheduleIndex = schedules.findIndex((s) => s.id === schedule.id)
    if (scheduleIndex !== -1) {
      schedules[scheduleIndex].notificationSent = true
      store.set('schedules', schedules)
    }
  } catch (error) {
    logAndSend('error', `[이메일 알림] 발송 실패 (일정 ID: ${schedule.id})`, { err: error })
  }
}

async function checkSchedulesAndSendNotifications() {
  const schedules = store.get('schedules', []) as Schedule[]
  const now = new Date()

  for (const schedule of schedules) {
    if (schedule.status !== 'pending' || schedule.notificationSent) continue

    const scheduleTime = new Date(`${schedule.date}T${schedule.time}`)
    const notificationTime = new Date(scheduleTime.getTime() - 60 * 60 * 1000)

    if (now >= notificationTime && now < scheduleTime) await sendNotificationEmail(schedule)
  }
}

function sendUpdateStatus(status: string, data: Record<string, any> = {}) {
  const messages: Record<string, string> = {
    checking: '업데이트 확인 시작...',
    available: `새 버전(${data.version}) 발견`,
    'not-available': '최신 버전을 사용 중입니다.',
    downloading: `다운로드 중... ${Math.round(data.percent || 0)}%`,
    downloaded: '다운로드 완료. 재시작 시 설치됩니다.',
    error: `오류 발생: ${data.error}`
  }
  const message = messages[status] || status

  if (status === 'error') {
    logAndSend('error', `[업데이트] ${message}`, data)
  } else {
    logAndSend('info', `[업데이트] ${message}`)
  }
  mainWindow?.webContents.send('update-status', { status, ...data })
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'))
  autoUpdater.on('update-available', (info) => sendUpdateStatus('available', info))
  autoUpdater.on('update-not-available', () => sendUpdateStatus('not-available'))
  autoUpdater.on('error', (err) => sendUpdateStatus('error', { error: err.message }))
  autoUpdater.on('download-progress', (progressObj) => sendUpdateStatus('downloading', progressObj))
  autoUpdater.on('update-downloaded', () => sendUpdateStatus('downloaded'))
}

function isBusinessHours(): boolean {
  const now = new Date()
  const hours = now.getHours()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  return hours >= BUSINESS_HOURS_START && hours < BUSINESS_HOURS_END
}

async function openUniPost(srIdx: string) {
  await shell.openExternal(`${SUPPORT_URL}?access=list&srIdx=${srIdx}`)
}

async function ensureLoggedIn() {
  const checkLoginResult = await checkLoginSession()
  logAndSend('info', `[로그인] 세션 확인 결과: ${checkLoginResult.message}`)
  if (checkLoginResult.success) return checkLoginResult

  const settings = store.get('settings', {}) as Settings
  if (!settings.username || !settings.password) {
    return { success: false, message: '계정 정보가 설정되지 않았습니다.' }
  }

  logAndSend('info', '[로그인] 세션이 없어 새로 로그인을 시도합니다.')
  return performLogin(settings.username, settings.password)
}

async function performLogin(username, password) {
  try {
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

    await new Promise((resolve) => setTimeout(resolve, 3000))
    return await checkLoginSession()
  } catch (error: any) {
    return { success: false, message: error.toString() }
  }
}

async function checkLoginSession() {
  try {
    if (!supportWindow) return { success: false, message: 'Support window is not available.' }
    const checkLoginResult = await supportWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const errorEl = document.querySelector('.up-alarm-box .up-alarm-message');
            if (errorEl && getComputedStyle(document.querySelector("#up-alarm")).display === "block") return { success: false, message: errorEl.textContent.trim() || "로그인 실패" };
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
    if (checkLoginResult.message.includes('로그아웃')) supportWindow.loadURL(SUPPORT_URL)
    return checkLoginResult
  } catch (error: any) {
    return { success: false, message: '로그인 확인 중 오류: ' + error.toString() }
  }
}

function displayNotifications(alerts: AlertWithFlags[]) {
  const settings = store.get('settings', {}) as Settings
  if (!settings.enableNotifications) return

  const now = Date.now()
  const twoMinutesInMs = 2 * 60 * 1000

  while (activeNotifications.length > 0 && now - activeNotifications[0].createdAt > twoMinutesInMs) {
    activeNotifications.shift()
  }

  alerts.forEach((alert) => {
    const notification = new Notification({
      title: `${alert.CM_NAME}`,
      body: `${alert.REQ_TITLE}\n상태: ${alert.STATUS}\n`,
      icon: uniIcon
    })
    const notificationObj = { notification, srIdx: alert.SR_IDX, createdAt: Date.now() }

    notification.on('click', async () => {
      await openUniPost(alert.SR_IDX)
      if (mainWindow && process.platform === 'win32') mainWindow.flashFrame(false)
    })
    notification.show()
    activeNotifications.push(notificationObj)
  })

  if (mainWindow && alerts.length > 0 && process.platform === 'win32') {
    mainWindow.flashFrame(true)
  }

  setTimeout(() => {
    const currentTime = Date.now()
    const removeIndices: number[] = []
    activeNotifications.forEach((item, index) => {
      const isExpired = currentTime - item.createdAt > 30000
      const isDestroyed = item.notification && item.notification.isDestroyed && item.notification.isDestroyed()
      if (isExpired || isDestroyed) removeIndices.unshift(index)
    })
    removeIndices.forEach((index) => activeNotifications.splice(index, 1))
  }, 30000)
}

const formatRequestData = (item: Alert) => ({ ...item })
const addStatusFlags = (alert: Alert): AlertWithFlags => ({
  ...alert,
  isUrgent: !!(alert.REQ_TITLE && alert.REQ_TITLE.includes('긴급')),
  isDelayed: alert.PROCESS_DATE ? new Date().getTime() - new Date(alert.PROCESS_DATE).getTime() > 604800000 : false,
  isPending:
    alert.STATUS.includes('접수') && alert.REQ_DATE_ALL ? new Date().getTime() - new Date(alert.REQ_DATE_ALL).getTime() > 3600000 : false
})

async function checkForNewRequests(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await scrapeDataFromSite()
    store.set('lastChecked', new Date().toLocaleString())

    if (!result.success || !result.allRequests) {
      return { success: false, message: result.message }
    }

    const { allRequests, personalRequests } = result
    const existingAlerts = (store.get('alerts') || []) as AlertWithFlags[]
    const formattedAllRequests = allRequests.map(formatRequestData)

    const newAlerts = formattedAllRequests.filter((n) => !existingAlerts.some((e) => e.SR_IDX === n.SR_IDX))
    const statusChangedAlerts = formattedAllRequests.filter((n) => {
      const e = existingAlerts.find((ex) => ex.SR_IDX === n.SR_IDX)
      return e && e.STATUS !== n.STATUS && n.STATUS === '고객사답변'
    })

    const alertsWithFlags = formattedAllRequests.map(addStatusFlags)
    store.set('alerts', alertsWithFlags)
    store.set('personalRequests', personalRequests?.map(formatRequestData).map(addStatusFlags) || [])
    mainWindow?.webContents.send('new-alerts-available')

    if (existingAlerts.length > 0) displayNotifications(newAlerts.map(addStatusFlags))
    displayNotifications(statusChangedAlerts.map(addStatusFlags))

    const message = `총 ${alertsWithFlags.length}건 / 신규 ${newAlerts.length}건 / 상태변경 ${statusChangedAlerts.length}건`
    logAndSend('info', `[모니터링] 데이터 처리 완료 - ${message}`)
    return { success: true, message }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logAndSend('error', `[모니터링] 데이터 처리 중 오류 발생`, { err: errorMessage })
    return { success: false, error: errorMessage }
  }
}

async function scrapeDataFromSite() {
  try {
    if (!supportWindow) return { success: false, message: 'Support window is not available.' }
    const result = await supportWindow.webContents.executeJavaScript(`
      (async function() {
        function waitForLoadingToFinish(iframeDoc) {
          return new Promise((resolve) => {
            const loadingArea = iframeDoc.querySelector('.loading-area');
            if (!loadingArea) { resolve(); return; }
            const checkDisplay = () => {
              const style = window.getComputedStyle(loadingArea);
              if (style.display === 'none') { clearInterval(interval); resolve(); }
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
          iframe.contentWindow.UNIUX.Mask();
          await waitForLoadingToFinish(iframe.contentDocument);
          iframe.contentWindow.UNIUX.removeMask();
          iframe.contentWindow.UNIUX.SVC('PROGRESSION_TYPE', 'R,E,O,A,C,N,M');
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_SEARCH_TYPE', 'A');
          iframe.contentWindow.UNIUX.SVC('START_DATE',new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]);
          iframe.contentDocument.querySelector('#doSearch').click();
          await waitForLoadingToFinish(iframe.contentDocument);
          iframe.contentWindow.UNIUX.removeMask();
          const allRequestsData = iframe.contentWindow.grid.getAllRowValue();
          const currentUsername = document.querySelector('.userNm').textContent.trim();
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_SEARCH_TYPE', 'P');
          iframe.contentWindow.UNIUX.SVC('RECEIPT_INFO_TEXT', currentUsername);
          iframe.contentDocument.querySelector('#doSearch').click();
          await waitForLoadingToFinish(iframe.contentDocument);
          iframe.contentWindow.UNIUX.removeMask();
          const personalRequestsData = iframe.contentWindow.grid.getAllRowValue();
          iframe.contentWindow.UNIUX.removeMask();
          return { success: true, allRequestsData, personalRequestsData };
        } catch (error) {
          return { success: false, message: "데이터 스크래핑 오류: " + error.message };
        }
      })();
    `)

    if (result.success) {
      return { success: true, allRequests: result.allRequestsData, personalRequests: result.personalRequestsData }
    } else {
      logAndSend('error', `[스크래핑] 실패: ${result.message}`)
      return { success: false, message: result.message, allRequests: [], personalRequests: [] }
    }
  } catch (error: any) {
    logAndSend('error', `[스크래핑] 실행 중 예외 발생`, { err: error })
    return { success: false, message: error.toString(), allRequests: [], personalRequests: [] }
  }
}

async function startMonitoring(): Promise<{ success: boolean; message: string }> {
  if (isMonitoring) {
    logAndSend('warn', '[모니터링] 이미 실행 중인 상태에서 시작이 요청되어 건너뜁니다.')
    return { success: true, message: '이미 모니터링 중입니다.' }
  }

  const settings = store.get('settings', {}) as Settings
  if (!settings.username || !settings.password) {
    logAndSend('error', '[모니터링] 시작 실패 - 계정 정보가 설정되지 않았습니다.')
    return { success: false, message: '계정 정보가 설정되지 않았습니다.' }
  }

  const loginResult = await ensureLoggedIn()
  if (!loginResult.success) {
    logAndSend('error', `[모니터링] 시작 실패 - 로그인 문제: ${loginResult.message}`)
    return { success: false, message: loginResult.message }
  }

  isMonitoring = true
  mainWindow?.webContents.send('monitoring-status-changed', { isMonitoring: true })
  logAndSend('info', `[모니터링] 시작 (점검 간격: ${settings.checkInterval || 5}분)`)

  await checkForNewRequests()
  const intervalMs = (settings.checkInterval || 5) * 60 * 1000
  monitoringInterval = setInterval(checkForNewRequests, intervalMs)

  return { success: true, message: '모니터링을 시작합니다.' }
}

function stopMonitoring(isAutoPause = false): { success: boolean; message: string } {
  if (!isMonitoring) return { success: true, message: '이미 모니터링이 중지되었습니다.' }

  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
  isMonitoring = false

  if (!isAutoPause) {
    store.set('userMonitoringPref', 'off')
    logAndSend('info', '[모니터링] 중지 (사용자 요청)')
  } else {
    logAndSend('warn', '[모니터링] 자동 중지 (업무 시간 외)')
  }

  mainWindow?.webContents.send('monitoring-status-changed', { isMonitoring: false })
  return { success: true, message: '모니터링이 중지되었습니다.' }
}

function stateCheckLoop() {
  const userWantsMonitoring = store.get('userMonitoringPref') === 'on'
  const withinHours = isBusinessHours()

  if (!isManualStartTriggeredInSession) {
    if (isMonitoring && !withinHours) {
      logAndSend('warn', '[상태확인] 업무 시간이 아니므로 모니터링을 자동 중지합니다.')
      stopMonitoring(true)
    }
    return
  }

  if (userWantsMonitoring && withinHours && !isMonitoring) {
    logAndSend('info', '[상태확인] 업무 시간이 되어 모니터링을 자동으로 재시작합니다.')
    startMonitoring()
  } else if (isMonitoring && !withinHours) {
    logAndSend('warn', '[상태확인] 업무 시간이 종료되어 모니터링을 자동으로 중지합니다.')
    stopMonitoring(true)
  }
}

export function initializeIpcHandlers(win: BrowserWindow): void {
  mainWindow = win
  supportWindow = new BrowserWindow({
    show: true,
    width: 1200,
    height: 800,
    webPreferences: { preload: join(__dirname, '../preload/index.js') }
  })

  supportWindow.loadURL(SUPPORT_URL)
  setupAutoUpdater()

  ipcMain.handle('get-settings', () => store.get('settings', {}))
  ipcMain.handle('save-settings', async (_event, settings) => {
    try {
      store.set('settings', settings)
      logAndSend('info', '[설정] 저장 완료')
      return { success: true }
    } catch (e) {
      logAndSend('error', '[설정] 저장 실패', { err: e })
      return { success: false, message: '오류 발생' }
    }
  })
  ipcMain.handle('update-single-setting', async (_event, key, value) => {
    store.set(`settings.${key}`, value)
  })

  ipcMain.handle('toggle-monitoring', async (_event, shouldStart: boolean) => {
    if (shouldStart) {
      isManualStartTriggeredInSession = true
      store.set('userMonitoringPref', 'on')
      return startMonitoring()
    } else {
      return stopMonitoring(false)
    }
  })

  ipcMain.handle('get-alerts', async () => {
    try {
      return {
        success: true,
        alerts: store.get('alerts') || [],
        personalRequests: store.get('personalRequests') || [],
        lastChecked: store.get('lastChecked') || null
      }
    } catch (error: any) {
      logAndSend('error', '[데이터] 알림 목록 조회 실패', { err: error })
      return { success: false, error: error.toString() }
    }
  })

  ipcMain.handle('open-request', (_event, srIdx) => openUniPost(srIdx))
  ipcMain.handle('get-app-info', () => ({ version: app.getVersion() }))
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())
  ipcMain.handle('download-update', () => autoUpdater.downloadUpdate())
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true))

  ipcMain.handle('get-schedules', async () => ({ success: true, schedules: store.get('schedules', []) }))

  ipcMain.handle('add-schedule', async (_event, scheduleData) => {
    try {
      const schedules = store.get('schedules', []) as Schedule[]
      const newSchedule: Schedule = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        ...scheduleData,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
      schedules.push(newSchedule)
      store.set('schedules', schedules)
      logAndSend('info', `[일정] 추가 완료 (ID: ${newSchedule.id}, 제목: ${newSchedule.title})`)
      return { success: true, schedule: newSchedule }
    } catch (error: any) {
      logAndSend('error', '[일정] 추가 실패', { err: error })
      return { success: false, error: error.toString() }
    }
  })

  ipcMain.handle('update-schedule-status', async (_event, id, status) => {
    try {
      const schedules = store.get('schedules', []) as Schedule[]
      const index = schedules.findIndex((s) => s.id === id)
      if (index === -1) return { success: false, error: '일정을 찾을 수 없습니다.' }
      schedules[index].status = status
      store.set('schedules', schedules)
      logAndSend('info', `[일정] 상태 변경 완료 (ID: ${id}, 상태: ${status})`)
      return { success: true }
    } catch (error: any) {
      logAndSend('error', `[일정] 상태 변경 실패 (ID: ${id})`, { err: error })
      return { success: false, error: error.toString() }
    }
  })

  ipcMain.handle('delete-schedule', async (_event, id) => {
    try {
      const schedules = store.get('schedules', []) as Schedule[]
      const filtered = schedules.filter((s) => s.id !== id)
      if (schedules.length === filtered.length) return { success: false, error: '일정을 찾을 수 없습니다.' }
      store.set('schedules', filtered)
      logAndSend('info', `[일정] 삭제 완료 (ID: ${id})`)
      return { success: true }
    } catch (error: any) {
      logAndSend('error', `[일정] 삭제 실패 (ID: ${id})`, { err: error })
      return { success: false, error: error.toString() }
    }
  })

  setInterval(stateCheckLoop, 5 * 60 * 1000)
  setInterval(checkSchedulesAndSendNotifications, 60 * 1000)
}
