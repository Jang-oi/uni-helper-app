import { useEffect, useState } from 'react'
import { Bell, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'
import { AlertItem, AlertsDataTable } from '../components/ui/alerts-data-table'
import { Badge } from '../components/ui/badge'

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [personalRequests, setPersonalRequests] = useState<AlertItem[]>([])
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const { isMonitoring } = useAppStore()
  const [activeTab, setActiveTab] = useState('all')

  // 알림 목록 불러오기
  const loadAlerts = async () => {
    if (!isMonitoring) return
    try {
      const result = await window.electron.ipcRenderer.invoke('get-alerts')

      if (result.success) {
        setAlerts(result.alerts || [])
        setPersonalRequests(result.personalRequests || [])
        setLastChecked(result.lastChecked || null)
      } else {
        console.error('알림 로드 실패:', result.error || result.message)
      }
    } catch (error) {
      console.error('Failed to load alerts:', error)
      toast.error('알림 로드 실패', {
        description: '알림 내역을 불러오는 중 오류가 발생했습니다.'
      })
    }
  }

  useEffect(() => {
    // 앱 상태와 관계없이 이벤트 리스너는 항상 등록
    const newAlertsListener = window.electron.ipcRenderer.on('new-alerts-available', loadAlerts)
    return () => {
      newAlertsListener()
    }
  }, []) // 빈 배열로 마운트 시 한 번만 실행

  useEffect(() => {
    // 모니터링이 시작될 때만 최초 데이터 로드
    if (isMonitoring) {
      loadAlerts()
    } else {
      // 모니터링 중지 시 데이터 초기화
      setAlerts([])
      setPersonalRequests([])
      setLastChecked(null)
    }
  }, [isMonitoring])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isMonitoring && (
        <div className="p-4 rounded-lg mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">알림 상태</h3>
              <p className="text-sm text-muted-foreground">{lastChecked ? `마지막 확인: ${lastChecked}` : '알림을 확인하는 중입니다...'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm text-red-600 dark:text-red-400">긴급 요청</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span className="text-sm text-amber-600 dark:text-amber-400">처리 지연</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-sm text-blue-600 dark:text-blue-400">1시간 미처리</span>
            </div>
          </div>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-1">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            전체 알림
            <Badge variant="secondary" className="ml-1">
              {alerts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />내 처리 건
            <Badge variant="secondary" className="ml-1">
              {personalRequests.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>전체 알림 내역</CardTitle>
              <CardDescription>
                컬럼 헤더를 클릭하여 정렬할 수 있습니다. (Shift 키를 누르고 여러 헤더 클릭 시 다중 정렬 가능)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(84vh-300px)]">
                <AlertsDataTable data={alerts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>내 처리 건</CardTitle>
              <CardDescription>현재 사용자가 처리 중인 접수 건을 표시합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(84vh-300px)]">
                <AlertsDataTable data={personalRequests} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
