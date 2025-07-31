import { useEffect, useState } from 'react'
import { AlertCircle, Calendar, CheckCircle, Download, FilePen, GitCommit, Info, Loader2, RefreshCw, Tag, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAlertDialogStore } from '@/store/alert-dialog-store'
import { useLogStore } from '@/store/log-store'

interface AppInfo {
  version: string
}

interface UpdateHistoryItem {
  version: string
  date: string
  author: string
  title: string
  changes: string[]
}

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseName: string
  releaseNotes: string
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

interface DownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export function AboutPage() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [history, setHistory] = useState<UpdateHistoryItem[]>([])
  const [activeTab, setActiveTab] = useState('update')

  // 업데이트 관련 상태
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const { openConfirm } = useAlertDialogStore()

  const { logs, clearLogs } = useLogStore()

  // 업데이트 상태 리스너 등록
  useEffect(() => {
    const handleUpdateStatus = (_event: any, data: any) => {
      const { status } = data
      setUpdateStatus(status)

      switch (status) {
        case 'checking':
          break

        case 'available':
          setUpdateInfo({
            version: data.version,
            releaseDate: new Date(data.releaseDate).toLocaleDateString(),
            releaseName: data.releaseName || `버전 ${data.version}`,
            releaseNotes: data.releaseNotes || '새로운 업데이트가 있습니다.'
          })
          break

        case 'not-available':
          break

        case 'downloading':
          setDownloadProgress(data)
          if (!showDownloadDialog) {
            setShowDownloadDialog(true)
          }
          break

        case 'downloaded':
          setShowDownloadDialog(false)

          // 재시작 확인 다이얼로그
          openConfirm({
            title: '업데이트 설치',
            description: '업데이트 설치를 위해 애플리케이션을 재시작하시겠습니까?\n재시작 후 자동으로 업데이트가 적용됩니다.',
            confirmText: '재시작',
            cancelText: '나중에',
            onConfirm: handleInstallUpdate
          })
          break

        case 'error':
          setErrorMessage(data.error || '업데이트 중 오류가 발생했습니다.')
          setShowDownloadDialog(false)
          toast.error('업데이트 오류', { description: data.error || '업데이트 중 오류가 발생했습니다.' })
          break
      }
    }

    window.electron.ipcRenderer.on('update-status', handleUpdateStatus)
  }, [showDownloadDialog, openConfirm])

  // 페이지 진입 시 자동 업데이트 확인
  useEffect(() => {
    checkForUpdates()
  }, [])

  useEffect(() => {
    async function fetchUpdateHistory() {
      try {
        // 본인의 GitHub 사용자명과 레포지토리 이름으로 변경하세요.
        const owner = 'Jang-oi'
        const repo = 'uni-helper-app'
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`)

        if (!response.ok) {
          toast.error('GitHub 릴리즈 정보 로드 실패', { description: 'GitHub 릴리즈 정보를 가져오는 데 실패했습니다.' })
          throw new Error('GitHub 릴리즈 정보를 가져오는 데 실패했습니다.')
        }

        const releases = await response.json()

        const formattedHistory = releases.map((release: any): UpdateHistoryItem => {
          // 릴리즈 본문(body)을 줄바꿈 기준으로 나누고, '*' 또는 '-'로 시작하는 항목만 추출
          const changes = release.body
            .split('\n')
            .filter((line: string) => line.trim().startsWith('* ') || line.trim().startsWith('- '))
            .map((line: string) => line.trim().substring(2).trim()) // '* ' 또는 '- ' 제거

          return {
            version: release.tag_name,
            date: new Date(release.published_at).toLocaleDateString(),
            author: release.author.login,
            title: release.name,
            changes: changes.length > 0 ? changes : ['자세한 내용은 GitHub 릴리즈 노트를 참고하세요.']
          }
        })

        setHistory(formattedHistory)
      } catch (err: any) {
        toast.error('GitHub 릴리즈 정보 로드 실패', { description: err.message })
      }
    }

    fetchUpdateHistory()
  }, []) // 컴포넌트 마운트 시 1회만 실행

  // 앱 정보 로드
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const info = await window.electron.ipcRenderer.invoke('get-app-info')
        setAppInfo(info)
      } catch (error) {
        console.error('앱 정보 로드 실패:', error)
      }
    }
    loadAppInfo()
  }, [])

  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking')
      await window.electron.ipcRenderer.invoke('check-for-updates')
    } catch (error) {
      console.error('업데이트 확인 실패:', error)
      toast.error('업데이트 확인 실패', { description: '업데이트 확인 중 오류가 발생했습니다.' })
    }
  }

  const handleDownloadUpdate = async () => {
    try {
      await window.electron.ipcRenderer.invoke('download-update')
    } catch (error) {
      console.error('업데이트 다운로드 실패:', error)
      toast.error('다운로드 실패', { description: '업데이트 다운로드 중 오류가 발생했습니다.' })
    }
  }

  const handleInstallUpdate = async () => {
    try {
      await window.electron.ipcRenderer.invoke('install-update')
    } catch (error) {
      console.error('업데이트 설치 실패:', error)
      toast.error('설치 실패', { description: '업데이트 설치 중 오류가 발생했습니다.' })
    }
  }

  const getUpdateStatusIcon = () => {
    switch (updateStatus) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'available':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'not-available':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'downloading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'downloaded':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <RefreshCw className="h-4 w-4 text-gray-500" />
    }
  }

  const getUpdateStatusText = () => {
    switch (updateStatus) {
      case 'checking':
        return '업데이트 확인 중...'
      case 'available':
        return '새 업데이트 사용 가능'
      case 'not-available':
        return '최신 버전입니다'
      case 'downloading':
        return '다운로드 중...'
      case 'downloaded':
        return '다운로드 완료 - 재시작 필요'
      case 'error':
        return '업데이트 오류'
      default:
        return '업데이트 확인'
    }
  }

  const getUpdateButton = () => {
    switch (updateStatus) {
      case 'checking':
        return (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            확인 중...
          </Button>
        )
      case 'available':
        return (
          <Button size="sm" onClick={handleDownloadUpdate}>
            <Download className="h-4 w-4 mr-2" />
            업데이트 다운로드
          </Button>
        )
      case 'downloading':
        return (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            다운로드 중...
          </Button>
        )
      case 'downloaded':
        return (
          <Button
            size="sm"
            onClick={() =>
              openConfirm({
                title: '업데이트 설치',
                description: '업데이트 설치를 위해 애플리케이션을 재시작하시겠습니까?\n재시작 후 자동으로 업데이트가 적용됩니다.',
                confirmText: '재시작',
                cancelText: '나중에',
                onConfirm: handleInstallUpdate
              })
            }
          >
            지금 재시작
          </Button>
        )
      case 'error':
        return (
          <Button variant="outline" size="sm" onClick={checkForUpdates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            다시 시도
          </Button>
        )
      default:
        return (
          <Button variant="outline" size="sm" onClick={checkForUpdates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            업데이트 확인
          </Button>
        )
    }
  }

  const getAdditionalInfo = () => {
    switch (updateStatus) {
      case 'available':
        return updateInfo ? (
          <div className="text-xs text-muted-foreground mt-1">
            새 버전: {updateInfo.version} • {updateInfo.releaseDate}
          </div>
        ) : null
      case 'downloaded':
        return <div className="text-xs text-green-600 dark:text-green-400 mt-1">재시작하여 업데이트를 적용하세요</div>
      case 'error':
        return errorMessage ? <div className="text-xs text-red-600 dark:text-red-400 mt-1">{errorMessage}</div> : null
      case 'downloading':
        return downloadProgress ? (
          <div className="text-xs text-muted-foreground mt-1">
            {Math.round(downloadProgress.percent)}% • {formatSpeed(downloadProgress.bytesPerSecond)}
          </div>
        ) : null
      default:
        return <div className="text-xs text-muted-foreground">현재 버전: {appInfo?.version || '1.0.0'}</div>
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  return (
    <div className="flex flex-col h-[calc(95vh-80px)] space-y-2">
      <div className="flex items-center gap-3 p-3 rounded-lg border border-l-4 border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/10">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <div className="text-sm font-medium text-purple-900 dark:text-purple-100">업무 모니터링 시스템</div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="text-xs text-purple-700">
            버전 {appInfo?.version || '1.0.0'}
          </Badge>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="update" className="flex items-center gap-1 text-xs">
            <Download className="h-3 w-3" />
            업데이트 관리
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-1 text-xs">
            <GitCommit className="h-3 w-3" />
            업데이트 정보
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1 text-xs">
            <FilePen className="h-3 w-3" />
            로그 정보
          </TabsTrigger>
        </TabsList>
        <TabsContent value="update" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                업데이트 관리
              </CardTitle>
              <CardDescription className="text-xs">프로그램의 최신 버전을 확인하고 업데이트를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  {getUpdateStatusIcon()}
                  <div>
                    <div className="text-sm font-medium">{getUpdateStatusText()}</div>
                    {getAdditionalInfo()}
                  </div>
                </div>
                {getUpdateButton()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                업데이트 정보
              </CardTitle>
              <CardDescription className="text-xs">최근 업데이트 내역과 변경 사항을 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-[calc(66vh-80px)]">
                <div className="space-y-4">
                  {history.length === 0 && <p className="text-center text-muted-foreground">릴리즈 노트를 찾을 수 없습니다.</p>}
                  {history.map((update, index) => (
                    <div key={update.version} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">{update.title}</h3>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span>{update.version}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{update.date}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{update.author}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground">주요 변경 사항</h4>
                        <ul className="space-y-1">
                          {update.changes.map((change, changeIndex) => (
                            <li key={changeIndex} className="flex items-start gap-2 text-xs">
                              <div className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {index < history.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>시스템 로그</CardTitle>
                  <CardDescription>메인 프로세스에서 발생하는 실시간 로그입니다.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={clearLogs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    로그 초기화
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(66vh-80px)] p-4">
                <div className="space-y-2 text-xs font-mono">
                  {logs.length === 0 ? (
                    <p className="text-center text-muted-foreground">아직 로그가 없습니다.</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span
                          className={log.level === 'error' ? 'text-red-500' : log.level === 'warn' ? 'text-yellow-500' : 'text-foreground'}
                        >
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="whitespace-pre-wrap">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 다운로드 진행 다이얼로그 */}
      <Dialog open={showDownloadDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              업데이트 다운로드 중
            </DialogTitle>
            <DialogDescription>새 버전을 다운로드하고 있습니다. 잠시만 기다려주세요.</DialogDescription>
          </DialogHeader>

          {downloadProgress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>진행률</span>
                  <span>{Math.round(downloadProgress.percent)}%</span>
                </div>
                <Progress value={downloadProgress.percent} className="w-full" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <div>다운로드 속도</div>
                  <div className="font-medium">{formatSpeed(downloadProgress.bytesPerSecond)}</div>
                </div>
                <div>
                  <div>진행 상황</div>
                  <div className="font-medium">
                    {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                다운로드 중... 창을 닫지 마세요
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
