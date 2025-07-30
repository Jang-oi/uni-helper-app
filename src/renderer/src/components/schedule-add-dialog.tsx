import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useScheduleStore } from '@/store/schedule-store'

// 폼 데이터 타입
interface ScheduleFormData {
  title: string
  description: string
  date: string
  time: string
}

export function ScheduleAddDialog() {
  const { isAddDialogOpen, dialogData, closeAddDialog } = useScheduleStore()

  const form = useForm<ScheduleFormData>({
    defaultValues: {
      title: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00'
    }
  })

  // 다이얼로그가 열릴 때 데이터 설정
  useEffect(() => {
    if (isAddDialogOpen && dialogData) {
      form.setValue('title', `[배포] ${dialogData.requestTitle}`)
      form.setValue('description', `고객사: ${dialogData.customerName}\n요청사항: ${dialogData.requestTitle}\nSR번호: ${dialogData.srIdx}`)
      form.setValue('date', format(dialogData.date ?? new Date(), 'yyyy-MM-dd'))
    } else if (isAddDialogOpen && !dialogData) {
      // 일반 일정 추가인 경우 폼 초기화
      form.reset({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00'
      })
    }
  }, [isAddDialogOpen, dialogData, form])

  // 일정 추가
  const addSchedule = async (data: ScheduleFormData) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('add-schedule', {
        ...data,
        srIdx: dialogData?.srIdx || '',
        customerName: dialogData?.customerName,
        requestTitle: dialogData?.requestTitle
      })

      if (result.success) {
        toast.success('일정이 추가되었습니다')
        closeAddDialog()
        form.reset()

        // 일정이 추가되었음을 전역으로 알림 (schedule-page에서 새로고침하도록)
        window.dispatchEvent(new CustomEvent('schedule-added'))
      } else {
        toast.error('일정 추가 실패', {
          description: result.error || '일정 추가 중 오류가 발생했습니다.'
        })
      }
    } catch (error) {
      console.error('일정 추가 중 오류:', error)
      toast.error('일정 추가 실패', {
        description: '일정 추가 중 오류가 발생했습니다.'
      })
    }
  }

  const handleClose = () => {
    closeAddDialog()
    form.reset()
  }

  return (
    <Dialog open={isAddDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />새 일정 추가
          </DialogTitle>
          <DialogDescription>{dialogData ? '배포 일정을 추가합니다.' : '새로운 일정을 추가합니다.'}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(addSchedule)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              rules={{ required: '제목을 입력해주세요.' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">제목</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-sm" placeholder="일정 제목을 입력하세요" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">설명</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="text-sm resize-none" rows={3} placeholder="일정에 대한 설명을 입력하세요" />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                rules={{ required: '날짜를 선택해주세요.' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">날짜</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-8 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                rules={{ required: '시간을 선택해주세요.' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">시간</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" className="h-8 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                취소
              </Button>
              <Button type="submit" size="sm">
                추가
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
