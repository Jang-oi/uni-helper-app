import { useEffect, useState } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AlertCircle, CalendarIcon, CheckCircle, Clock, FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScheduleStore } from '@/store/schedule-store'

// 일정 타입 정의
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
}

export function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('calendar')

  const { openAddDialog } = useScheduleStore()

  // 일정 목록 로드
  const loadSchedules = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('get-schedules')
      if (result.success) {
        setSchedules(result.schedules || [])
      } else {
        console.error('일정 로드 실패:', result.error)
      }
    } catch (error) {
      console.error('일정 로드 중 오류:', error)
      toast.error('일정 로드 실패', {
        description: '일정을 불러오는 중 오류가 발생했습니다.'
      })
    }
  }

  // 일정 상태 업데이트
  const updateScheduleStatus = async (scheduleId: string, status: Schedule['status']) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('update-schedule-status', scheduleId, status)

      if (result.success) {
        toast.success('일정 상태가 업데이트되었습니다')
        loadSchedules()
        if (selectedSchedule?.id === scheduleId) {
          setSelectedSchedule({ ...selectedSchedule, status })
        }
      } else {
        toast.error('상태 업데이트 실패', { description: result.error || '상태 업데이트 중 오류가 발생했습니다.' })
      }
    } catch (error) {
      console.error('상태 업데이트 중 오류:', error)
      toast.error('상태 업데이트 실패')
    }
  }

  // 일정 삭제
  const deleteSchedule = async (scheduleId: string) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('delete-schedule', scheduleId)

      if (result.success) {
        toast.success('일정이 삭제되었습니다')
        loadSchedules()
        setIsViewDialogOpen(false)
        setSelectedSchedule(null)
      } else {
        toast.error('일정 삭제 실패', {
          description: result.error || '일정 삭제 중 오류가 발생했습니다.'
        })
      }
    } catch (error) {
      console.error('일정 삭제 중 오류:', error)
      toast.error('일정 삭제 실패')
    }
  }

  // 컴포넌트 마운트 시 일정 로드
  useEffect(() => {
    loadSchedules()
  }, [])

  // 전역 일정 추가 이벤트 리스너 추가
  useEffect(() => {
    const handleScheduleAdded = () => {
      loadSchedules()
    }

    window.addEventListener('schedule-added', handleScheduleAdded)

    return () => {
      window.removeEventListener('schedule-added', handleScheduleAdded)
    }
  }, [])

  // 일정 추가 다이얼로그 열기 함수
  const handleOpenAddDialog = () => {
    openAddDialog({ date: selectedDate })
  }

  // 선택된 날짜의 일정 필터링 및 완료 상태 확인
  const selectedDateSchedules = schedules.filter((schedule) => isSameDay(parseISO(schedule.date), selectedDate))

  // 캘린더에 일정이 있는 날짜와 완료된 일정만 있는 날짜 구분
  const scheduleDates = schedules.map((schedule) => parseISO(schedule.date))
  const completedDates = schedules.reduce(
    (acc, schedule) => {
      const date = parseISO(schedule.date)
      const dateKey = format(date, 'yyyy-MM-dd')

      if (!acc[dateKey]) {
        acc[dateKey] = { total: 0, completed: 0, date }
      }

      acc[dateKey].total++
      if (schedule.status === 'completed') {
        acc[dateKey].completed++
      }

      return acc
    },
    {} as Record<string, { total: number; completed: number; date: Date }>
  )

  const allCompletedDates = Object.values(completedDates)
    .filter((item) => item.total > 0 && item.total === item.completed)
    .map((item) => item.date)

  // 상태별 배지 색상
  const getStatusBadge = (status: Schedule['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            완료
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-red-100 text-red-800 hover:bg-red-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            취소
          </Badge>
        )
      default:
        return (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            예정
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col h-[calc(95vh-80px)] space-y-2">
      {/* 상태 표시 바 */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-l-4 border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100">일정 관리</div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline" className="text-xs text-indigo-700">
            총 {schedules.length}개 일정
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="calendar" className="flex items-center gap-1 text-xs">
            <CalendarIcon className="h-3 w-3" />
            캘린더 보기
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-1 text-xs">
            <FileText className="h-3 w-3" />
            목록 보기
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="flex-1 mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* 캘린더 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center">일정 캘린더</CardTitle>
                    <CardDescription className="text-xs">날짜를 클릭하여 해당 날짜의 일정을 확인하세요.</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleOpenAddDialog} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    일정 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ko}
                  className="[--cell-size:3.5rem] md:[--cell-size:3.5rem]"
                  modifiers={{
                    hasSchedule: scheduleDates,
                    allCompleted: allCompletedDates
                  }}
                  modifiersStyles={{
                    hasSchedule: {
                      backgroundColor: 'rgb(99 102 241 / 0.1)',
                      color: 'rgb(99 102 241)',
                      fontWeight: '600'
                    },
                    allCompleted: {
                      backgroundColor: 'rgb(34 197 94 / 0.1)',
                      color: 'rgb(34 197 94)',
                      fontWeight: '600'
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{format(selectedDate, 'M월 d일 (E)', { locale: ko })} 일정</CardTitle>
                <CardDescription className="text-xs">{selectedDateSchedules.length}개의 일정이 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {selectedDateSchedules.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs">이 날짜에는 일정이 없습니다.</div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {selectedDateSchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedSchedule(schedule)
                            setIsViewDialogOpen(true)
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium">{schedule.time}</span>
                            </div>
                            {getStatusBadge(schedule.status)}
                          </div>
                          <div className="text-sm font-medium mb-1">{schedule.title}</div>
                          {schedule.description && <div className="text-xs text-muted-foreground line-clamp-2">{schedule.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list" className="flex-1 mt-2">
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    전체 일정 목록
                  </CardTitle>
                  <CardDescription className="text-xs">모든 일정을 시간순으로 정렬하여 표시합니다.</CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAddDialog} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  일정 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(66vh-80px)]">
                {schedules.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">등록된 일정이 없습니다.</div>
                ) : (
                  <div className="space-y-3 p-4">
                    {schedules
                      .sort((a, b) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime())
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-4 rounded-lg border bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedSchedule(schedule)
                            setIsViewDialogOpen(true)
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarIcon className="h-3 w-3" />
                                {format(parseISO(schedule.date), 'M월 d일', { locale: ko })}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {schedule.time}
                              </div>
                            </div>
                            {getStatusBadge(schedule.status)}
                          </div>
                          <div className="text-sm font-medium mb-1">{schedule.title}</div>
                          {schedule.description && <div className="text-xs text-muted-foreground line-clamp-2">{schedule.description}</div>}
                          {schedule.srIdx && (
                            <div className="flex items-center gap-1 mt-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                접수번호: {schedule.srIdx}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 일정 상세 보기 다이얼로그 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              일정 상세
            </DialogTitle>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{selectedSchedule.title}</h3>
                  {getStatusBadge(selectedSchedule.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(parseISO(selectedSchedule.date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {selectedSchedule.time}
                  </div>
                </div>
              </div>

              {selectedSchedule.description && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">설명</h4>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-lg">
                      {selectedSchedule.description}
                    </div>
                  </div>
                </>
              )}

              {selectedSchedule.srIdx && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted" // 클릭 가능하도록 스타일
                      onClick={() => window.electron.ipcRenderer.invoke('open-request', selectedSchedule.srIdx)}
                    >
                      접수 번호: {selectedSchedule.srIdx}
                    </Badge>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-between">
                <div className="flex gap-2">
                  {selectedSchedule.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateScheduleStatus(selectedSchedule.id, 'completed')}
                        className="h-7 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        완료
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateScheduleStatus(selectedSchedule.id, 'cancelled')}
                        className="h-7 text-xs"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        취소
                      </Button>
                    </>
                  )}
                  {selectedSchedule.status !== 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateScheduleStatus(selectedSchedule.id, 'pending')}
                      className="h-7 text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      대기로 변경
                    </Button>
                  )}
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteSchedule(selectedSchedule.id)} className="h-7 text-xs">
                  삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
