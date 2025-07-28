import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle, Clock, Hourglass, Timer, User } from 'lucide-react'
import { toast } from 'sonner'
import { AlertsDataTable, type AlertItem } from '@/components/ui/alerts-data-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'

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
    const newAlertsListener = window.electron.ipcRenderer.on('new-alerts-available', loadAlerts)
    return () => {
      newAlertsListener()
    }
  }, [])

  useEffect(() => {
    if (isMonitoring) {
      loadAlerts()
    } else {
      setAlerts([])
      setPersonalRequests([])
      setLastChecked(null)
    }
  }, [isMonitoring])

  return (
    <div className="flex flex-col h-[calc(95vh-80px)] space-y-2">
      <div className="flex items-center gap-3 p-3 rounded-lg border border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10">
        <div className="flex items-center gap-2">
          {isMonitoring ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {isMonitoring ? <>{lastChecked && `마지막 확인: ${lastChecked}`}</> : <>모니터링 중지됨</>}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="text-xs text-red-600">
            <AlertTriangle className="h-3 w-3" />
            업무 시간
          </Badge>
          <Badge variant="outline" className="text-xs text-amber-600">
            <Timer className="h-3 w-3" />
            업무 시간
          </Badge>
          <Badge variant="outline" className="text-xs text-blue-600">
            <Hourglass className="h-3 w-3" />
            미처리
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="all" className="flex items-center gap-1 text-xs">
            <Bell className="h-3 w-3" />
            전체 알림
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
              {alerts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-1 text-xs">
            <User className="h-3 w-3" />내 처리 건
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
              {personalRequests.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-sm">전체 알림 내역</CardTitle>
              <CardDescription className="text-xs">헤더 클릭으로 정렬 가능</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-2">
              <AlertsDataTable data={alerts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle className="text-sm">내 처리 건</CardTitle>
              <CardDescription className="text-xs">현재 사용자 처리 중인 접수 건</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-2">
              <AlertsDataTable data={personalRequests} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
