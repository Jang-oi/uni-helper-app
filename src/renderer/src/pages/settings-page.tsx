import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Bell, Clock, Info, Laptop, Lock, User } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useAppStore } from '@/store/app-store'
import { Slider } from '../components/ui/slider'

// Zod 스키마 대신 사용할 타입 정의
type SettingsFormValues = {
  username: string
  password: string
  checkInterval: number
  enableNotifications: boolean
  startAtLogin: boolean
}

export function SettingsPage() {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [isBusinessHours, setIsBusinessHours] = useState(true)
  const { setMonitoring, setLoading, isLoading, isMonitoring } = useAppStore()

  const form = useForm<SettingsFormValues>({
    defaultValues: {
      username: '',
      password: '',
      checkInterval: 5,
      enableNotifications: true,
      startAtLogin: false
    }
  })

  // 현재 시간 및 업무 시간 확인 로직 (07:00 ~ 20:00 KST)
  const updateTimeAndBusinessHours = useCallback(() => {
    const now = new Date()
    const hours = now.getHours()
    setIsBusinessHours(hours >= 7 && hours < 20)
    setCurrentTime(
      now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    )
  }, [])

  // 1분마다 시간 및 업무 시간 상태 업데이트
  useEffect(() => {
    updateTimeAndBusinessHours()
    const interval = setInterval(updateTimeAndBusinessHours, 60000)
    return () => clearInterval(interval)
  }, [updateTimeAndBusinessHours])

  // 컴포넌트 마운트 시 모니터링 및 설정 값 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electron.ipcRenderer.invoke('get-settings')
        if (settings) {
          form.reset({
            ...settings,
            enableNotifications: settings.enableNotifications !== false,
            startAtLogin: settings.startAtLogin === true
          })
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [form])

  // 모니터링 상태 변경 이벤트 리스너
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'monitoring-status-changed',
      (status: any) => {
        setMonitoring(status.isMonitoring)
      }
    )
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [setMonitoring])

  // 설정 저장 및 모니터링 토글 핸들러
  const onSubmit = async (values: SettingsFormValues) => {
    setLoading(true, '설정을 저장하고 있습니다...')
    try {
      await window.electron.ipcRenderer.invoke('save-settings', values)

      const newStatus = !isMonitoring
      const actionText = newStatus ? '시작' : '중지'

      setLoading(true, `모니터링을 ${actionText}하고 있습니다...`)

      const result = await window.electron.ipcRenderer.invoke('toggle-monitoring', newStatus)

      if (result.success) {
        setMonitoring(newStatus)
        if (newStatus) {
          toast.success('모니터링 시작', {
            description: `${values.checkInterval}분 간격으로 업무 요청을 확인합니다.`
          })
        } else {
          toast.info('모니터링 중지')
        }
      } else {
        toast.error(`모니터링 ${actionText} 실패`, {
          description: result.message || '로그인 정보를 확인해주세요.'
        })
        setMonitoring(false)
      }
    } catch (error) {
      toast.error('모니터링 상태 변경 중 오류가 발생했습니다.')
      setMonitoring(false)
    } finally {
      setLoading(false)
    }
  }

  // 개별 설정 항목을 변경하는 핸들러 (최적화)
  const handleSettingChange = async (key: keyof SettingsFormValues, value: any) => {
    try {
      // 변경된 값만 main 프로세스로 전송하여 업데이트
      await window.electron.ipcRenderer.invoke('update-single-setting', key, value)
      form.setValue(key, value) // form 상태도 동기화
      return true
    } catch (error) {
      console.error(`${key} 설정 저장 실패:`, error)
      return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${isMonitoring ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">업무 시간 모니터링 상태</h3>
            <p className="text-sm text-muted-foreground">
              {isMonitoring ? '모니터링 중' : '모니터링 중지됨'} • 현재 시간: {currentTime} (
              {isBusinessHours ? '업무 시간' : '업무 시간 외'})
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>계정 정보</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>알림 및 시스템</span>
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <TabsContent value="account" className="space-y-6">
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h3 className="text-lg font-medium mb-4">업무 사이트 접속 정보</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  업무 사이트 접속에 필요한 계정 정보를 입력하세요.
                </p>
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="username"
                      rules={{ required: '아이디를 입력해주세요.' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>아이디</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input {...field} className="pl-9" disabled={isMonitoring} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      rules={{ required: '비밀번호를 입력해주세요.' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>비밀번호</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="password"
                                {...field}
                                className="pl-9"
                                disabled={isMonitoring}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="checkInterval"
                    rules={{
                      required: '주기를 입력해주세요.',
                      min: { value: 1, message: '최소 1분 이상 설정해주세요' },
                      max: { value: 40, message: '최대 40분까지 설정 가능합니다' }
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>확인 주기 (분)</FormLabel>
                        <div className="flex items-center gap-4">
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              disabled={isMonitoring}
                              className="max-w-[120px]"
                            />
                          </FormControl>
                          <div className="flex-1">
                            <Slider
                              defaultValue={[field.value]}
                              max={40}
                              min={1}
                              onChange={(e: any) => field.onChange(e.target.value)}
                              disabled={isMonitoring}
                              className="w-full"
                            ></Slider>
                          </div>
                        </div>
                        <FormDescription>
                          업무 사이트를 확인할 주기를 분 단위로 설정하세요. (1~40분)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>업무 시간 모니터링</AlertTitle>
                <AlertDescription>
                  모니터링은 평일 07:00~20:00 사이에만 작동합니다.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant={isMonitoring ? 'destructive' : 'default'}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isMonitoring ? '모니터링 중지' : '모니터링 시작'}
                </Button>
              </div>
            </TabsContent>
          </form>

          <TabsContent value="notifications" className="space-y-6">
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-medium mb-4">알림 및 시스템 설정</h3>
              <p className="text-sm text-muted-foreground mb-6">
                새로운 업무 알림 및 프로그램 시작 설정을 구성합니다.
              </p>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="enableNotifications"
                  render={({ field }) => (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <FormLabel className="text-base font-normal">윈도우 알림</FormLabel>
                          <FormDescription>
                            새로운 업무 요청 시 윈도우 알림을 표시합니다.
                          </FormDescription>
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          className="cursor-pointer"
                          checked={field.value}
                          onCheckedChange={async (checked) => {
                            const success = await handleSettingChange(
                              'enableNotifications',
                              checked
                            )
                            if (success) {
                              toast.success(
                                checked ? '알림이 활성화되었습니다' : '알림이 비활성화되었습니다'
                              )
                            } else {
                              toast.error('알림 설정 저장에 실패했습니다')
                            }
                          }}
                        />
                      </FormControl>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startAtLogin"
                  render={({ field }) => (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Laptop className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <FormLabel className="text-base font-normal">
                            시작 프로그램 등록
                          </FormLabel>
                          <FormDescription>
                            컴퓨터 시작 시 프로그램을 자동으로 실행합니다.
                          </FormDescription>
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          className="cursor-pointer"
                          checked={field.value}
                          onCheckedChange={async (checked) => {
                            const success = await handleSettingChange('startAtLogin', checked)
                            if (success) {
                              toast.success(
                                checked
                                  ? '시작 프로그램에 등록되었습니다'
                                  : '시작 프로그램에서 제거되었습니다'
                              )
                            } else {
                              toast.error('시작 프로그램 설정에 실패했습니다')
                            }
                          }}
                        />
                      </FormControl>
                    </div>
                  )}
                />
              </div>
            </div>
          </TabsContent>
        </Form>
      </Tabs>
    </div>
  )
}
