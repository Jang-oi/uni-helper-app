// src/main/index.ts

import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, Menu, shell, Tray } from 'electron'
// 1. IPC 핸들러 초기화 함수 import
import { initializeIpcHandlers } from './ipc-handler'

export const uniIcon = is.dev
  ? join(__dirname, '../../build/icon.ico') // 개발 환경 경로
  : join(process.resourcesPath, 'icon.ico') // 빌드된 앱(프로덕션) 경로

let mainWindow: BrowserWindow
let tray: Tray
let isQuiting = false

// 2. 싱글 인스턴스 락 (앱 중복 실행 방지)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 두 번째 인스턴스가 실행되면, 기존 창을 보여주고 포커스합니다.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  // 3. BrowserWindow 옵션을 이전과 유사하게 수정
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: '업무 모니터',
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    icon: uniIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 4. 창이 닫힐 때 종료되는 대신 트레이로 최소화되도록 설정
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      mainWindow.minimize() // 대신 창 숨김
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // 개발 모드에서 F5 새로고침 (이전 로직과 동일)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F5') {
        mainWindow.reload()
        event.preventDefault()
      }
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 5. 트레이 아이콘 생성 함수
const createTray = () => {
  tray = new Tray(uniIcon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '종료',
      click: () => {
        isQuiting = true // 실제 종료를 위한 플래그 설정
        app.quit()
      }
    }
  ])

  tray.setToolTip('Unipost Helper')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow.show()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.unipost.helper')

  createTray()
  createWindow()

  if (mainWindow) initializeIpcHandlers(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
