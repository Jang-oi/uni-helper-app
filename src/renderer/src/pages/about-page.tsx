import { useEffect, useRef, useState } from 'react'
import { ArrowUpCircle, Calendar, Download, GitCommit, Info, RefreshCw, Tag, User } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UpdateDialog } from '@/components/ui/update-dialog'
import { UpdateNotifier } from '@/components/update-nitifier'
import { useUpdateStore } from '@/store/update-store'

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

export function AboutPage() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const { status, info, progress, setStatus } = useUpdateStore()

  // --- 2. 히스토리, 로딩, 에러 상태 관리 ---
  const [history, setHistory] = useState<UpdateHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('update')
  const downloadStartedRef = useRef(false)
  const hasCheckedOnMount = useRef(false)

  // --- 3. GitHub API로 릴리즈 노트 가져오는 로직 ---
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
        setHistoryError(err.message)
      } finally {
        setHistoryLoading(false)
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

  // 페이지 진입 시 자동으로 업데이트 확인 (최초 1회)
  useEffect(() => {
    if (appInfo && !hasCheckedOnMount.current) {
      hasCheckedOnMount.current = true
      checkForUpdates()
    }
  }, [appInfo])

  // 전역 상태(status)에 따라 다운로드 다이얼로그 제어
  useEffect(() => {
    if (status === 'downloading') {
      setIsDownloadDialogOpen(true)
    } else if (status === 'downloaded' || status === 'error') {
      setIsDownloadDialogOpen(false)
      downloadStartedRef.current = false
    }
  }, [status])

  // 업데이트 확인 함수
  const checkForUpdates = async () => {
    try {
      setStatus('checking')
      await window.electron.ipcRenderer.invoke('check-for-updates')
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error)
      setStatus('error', { error: String(error) })
      toast.error('업데이트 확인 실패', {
        description: '업데이트 확인 중 오류가 발생했습니다.'
      })
    }
  }

  // 업데이트 다운로드 함수
  const downloadUpdate = async () => {
    try {
      if (downloadStartedRef.current) return
      downloadStartedRef.current = true
      await window.electron.ipcRenderer.invoke('download-update')
    } catch (error) {
      console.error('업데이트 다운로드 중 오류:', error)
      setStatus('error', { error: String(error) })
      downloadStartedRef.current = false
      toast.error('업데이트 다운로드 실패', { description: '업데이트 다운로드 중 오류가 발생했습니다.' })
    }
  }

  // 업데이트 설치 함수
  const installUpdate = async () => {
    try {
      await window.electron.ipcRenderer.invoke('install-update')
    } catch (error) {
      console.error('업데이트 설치 중 오류:', error)
      toast.error('업데이트 설치 오류', { description: String(error) || '업데이트 설치 중 오류가 발생했습니다.' })
    }
  }

  // 다운로드 다이얼로그 닫기 함수
  const handleCloseDownloadDialog = () => {
    setIsDownloadDialogOpen(false)
    if (status === 'downloading') {
      setStatus('available', info) // 사용자가 임의로 닫으면 다시 받을 수 있도록 상태 변경
    }
  }

  return (
    <div className="flex flex-col h-[calc(95vh-80px)] space-y-2">
      <UpdateNotifier />
      <UpdateDialog
        isOpen={isDownloadDialogOpen}
        onClose={handleCloseDownloadDialog}
        version={info.version || ''}
        progress={progress}
        downloadSpeed={info.bytesPerSecond || 0}
        transferred={info.transferred || 0}
        total={info.total || 0}
        isComplete={status === 'downloaded'}
      />

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
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="update" className="flex items-center gap-1 text-xs">
            <Download className="h-3 w-3" />
            업데이트 관리
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-1 text-xs">
            <GitCommit className="h-3 w-3" />
            업데이트 정보
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
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">업데이트 상태</h4>
                </div>

                {status === 'checking' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 border">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-800">업데이트를 확인하고 있습니다...</span>
                  </div>
                )}

                {status === 'available' && info.version && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-green-50/50 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">새 버전 사용 가능</span>
                      </div>
                      <div className="text-xs text-green-700">버전 {info.version}으로 업데이트할 수 있습니다.</div>
                    </div>
                    <Button onClick={downloadUpdate} className="w-full h-9">
                      <Download className="mr-2 h-4 w-4" />
                      {info.version} 버전 업데이트 하기
                    </Button>
                  </div>
                )}

                {status === 'not-available' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-gray-50/50 border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-800">최신 버전 사용 중</span>
                      </div>
                      <div className="text-xs text-gray-700">현재 최신 버전을 사용하고 있습니다.</div>
                    </div>
                    <Button disabled className="w-full h-9 bg-transparent" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      업데이트 가능한 버전이 없습니다
                    </Button>
                  </div>
                )}

                {status === 'downloaded' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-green-50/50 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">업데이트 준비 완료</span>
                      </div>
                      <div className="text-xs text-green-700">버전 {info.version}이 다운로드되었습니다.</div>
                    </div>
                    <Button onClick={installUpdate} className="w-full h-9">
                      <ArrowUpCircle className="mr-2 h-4 w-4" />
                      지금 설치하기
                    </Button>
                  </div>
                )}

                {(status === 'idle' || status === 'error') && (
                  <Button onClick={checkForUpdates} variant="outline" className="w-full h-9 bg-transparent">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    업데이트 다시 확인
                  </Button>
                )}
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
                  {/* --- 4. 조건부 렌더링으로 히스토리 표시 --- */}
                  {historyLoading && <p className="text-center text-muted-foreground">로딩 중...</p>}
                  {historyError && <p className="text-center text-red-500">오류: {historyError}</p>}
                  {!historyLoading && !historyError && history.length === 0 && (
                    <p className="text-center text-muted-foreground">릴리즈 노트를 찾을 수 없습니다.</p>
                  )}
                  {!historyLoading &&
                    !historyError &&
                    history.map((update, index) => (
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
      </Tabs>
    </div>
  )
}
