import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'

export function AlertsPage() {
  const { setLoading } = useAppStore()

  const handleStartLoading = () => {
    setLoading(true, '데이터를 불러오는 중...')

    // 3초 후 로딩 종료 (테스트용)
    setTimeout(() => {
      setLoading(false)
    }, 3000)
  }

  const handleStartMonitoring = () => {
    setLoading(true, '모니터링을 시작하는 중...')

    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">로딩 테스트</h3>
      <div className="flex gap-2">
        <Button onClick={handleStartLoading}>데이터 로딩 테스트</Button>
        <Button onClick={handleStartMonitoring} variant="outline">
          모니터링 시작 테스트
        </Button>
      </div>
    </div>
  )
}
