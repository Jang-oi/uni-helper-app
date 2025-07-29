import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Bell, CheckCircle, Clock, Info, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app-store'

type SettingsFormValues = {
  username: string
  password: string
  checkInterval: number
  enableNotifications: boolean
}

export function SettingsPage() {
  const [isBusinessHours, setIsBusinessHours] = useState(true)
  const { setLoading, isLoading, isMonitoring } = useAppStore()

  const form = useForm<SettingsFormValues>({
    defaultValues: { username: '', password: '', checkInterval: 5, enableNotifications: true }
  })

  // 현재 시간 및 업무 시간 확인 로직 (07:00 ~ 20:00 KST)
  const updateTimeAndBusinessHours = useCallback(() => {
    const now = new Date()
    const hours = now.getHours()
    setIsBusinessHours(hours >= 7 && hours < 20)
  }, [])

  // 1분마다 시간 및 업무 시간 상태 업데이트
  useEffect(() => {
    updateTimeAndBusinessHours()
    const interval = setInterval(updateTimeAndBusinessHours, 60000)
    return () => clearInterval(interval)
  }, [updateTimeAndBusinessHours])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electron.ipcRenderer.invoke('get-settings')
        if (settings) form.reset({ ...settings })
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // '모니터링 시작/중지' 버튼 클릭 시 실행될 메인 함수
  const handleToggleMonitoring = async (values: SettingsFormValues) => {
    if (!isMonitoring) {
      setLoading(true, '설정을 저장하고 모니터링을 시작합니다...')
      try {
        await window.electron.ipcRenderer.invoke('save-settings', values)
        const result = await window.electron.ipcRenderer.invoke('toggle-monitoring', true)
        if (result.success) {
          toast.success('모니터링 시작 성공', { description: result.message })
        } else {
          toast.error('모니터링 시작 실패', { description: result.message || '오류가 발생했습니다.' })
        }
      } catch (error) {
        toast.error('요청 처리 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(true, '모니터링을 중지하고 있습니다...')
      try {
        const result = await window.electron.ipcRenderer.invoke('toggle-monitoring', false)
        if (result.success) {
          toast.success('모니터링 중지 성공', { description: result.message })
        } else {
          toast.error('모니터링 중지 실패', { description: result.message || '오류가 발생했습니다.' })
        }
      } catch (error) {
        toast.error('요청 처리 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
  }

  // 개별 설정 변경 핸들러 (알림 스위치 등)
  const handleSettingChange = async (key: keyof SettingsFormValues, value: any) => {
    try {
      await window.electron.ipcRenderer.invoke('update-single-setting', key, value)
      form.setValue(key, value)
      return true
    } catch (error) {
      console.error(`${key} 설정 저장 실패:`, error)
      return false
    }
  }

  return (
    <div className="flex flex-col h-[calc(95vh-80px)] space-y-2">
      <div className="flex items-center gap-3 p-3 rounded-lg border border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-950/10">
        <div className="flex items-center gap-2">
          {isMonitoring ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <div className="text-sm font-medium text-green-900 dark:text-green-100">{isMonitoring ? '모니터링 중' : '모니터링 중지됨'}</div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant={isBusinessHours ? 'default' : 'secondary'} className="text-xs">
            {isBusinessHours ? '업무 시간' : '업무 시간 외'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="account" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="account" className="flex items-center gap-1 text-xs">
            <User className="h-3 w-3" />
            계정 정보
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs">
            <Bell className="h-3 w-3" />
            알림 및 시스템
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleToggleMonitoring)} className="flex-1 flex flex-col">
            <TabsContent value="account" className="flex-1 mt-2">
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">업무 사이트 접속 정보</CardTitle>
                  <CardDescription className="text-xs">업무 사이트 접속에 필요한 계정 정보를 입력하세요.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      rules={{ required: '아이디를 입력해주세요.' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">아이디</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                              <Input {...field} className="pl-7 h-8 text-xs" disabled={isMonitoring} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      rules={{ required: '비밀번호를 입력해주세요.' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">비밀번호</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                              <Input type="password" {...field} className="pl-7 h-8 text-xs" disabled={isMonitoring} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="checkInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">확인 주기 (분)</FormLabel>
                        <div className="flex items-center gap-3">
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              disabled={isMonitoring}
                              className="w-16 h-8 text-xs"
                            />
                          </FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                            max={40}
                            min={1}
                            disabled={isMonitoring}
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-8">{field.value}분</span>
                        </div>
                        <FormDescription className="text-xs">업무 사이트를 확인할 주기를 분 단위로 설정하세요. (1~40분)</FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
                    <Info className="h-3 w-3" />
                    <AlertTitle className="text-xs">업무 시간 모니터링</AlertTitle>
                    <AlertDescription className="text-xs">모니터링은 평일 07:00~20:00 사이에만 작동합니다.</AlertDescription>
                  </Alert>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant={isMonitoring ? 'destructive' : 'default'}
                      disabled={isLoading}
                      className="h-8 px-6 text-xs"
                    >
                      {isMonitoring ? '모니터링 중지' : '모니터링 시작'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="flex-1 mt-2">
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">알림 및 시스템 설정</CardTitle>
                  <CardDescription className="text-xs">새로운 업무 알림 및 프로그램 시작 설정을 구성합니다.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <FormField
                    control={form.control}
                    name="enableNotifications"
                    render={({ field }) => (
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <Bell className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <FormLabel className="text-xs font-medium">윈도우 알림</FormLabel>
                            <FormDescription className="text-xs">새로운 업무 요청 시 윈도우 알림을 표시합니다.</FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            className="cursor-pointer scale-75"
                            checked={field.value}
                            onCheckedChange={async (checked) => {
                              const success = await handleSettingChange('enableNotifications', checked)
                              if (success) {
                                toast.success(checked ? '알림이 활성화되었습니다' : '알림이 비활성화되었습니다')
                              } else {
                                toast.error('알림 설정 저장에 실패했습니다')
                              }
                            }}
                          />
                        </FormControl>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </form>
        </Form>
      </Tabs>
    </div>
  )
}
