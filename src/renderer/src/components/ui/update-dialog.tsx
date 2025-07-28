import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

interface UpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  version: string
  progress: number
  downloadSpeed: number
  transferred: number
  total: number
  isComplete?: boolean
}

export function UpdateDialog({
  isOpen,
  onClose,
  version,
  progress,
  downloadSpeed,
  transferred,
  total,
  isComplete = false
}: UpdateDialogProps) {
  // 다운로드 속도 및 진행률 포맷팅 함수
  const formatDownloadSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(1)} B/s`
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) {
      return '0 B'
    }
    if (bytes < 1024) {
      return `${bytes.toFixed(1)} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
  }

  // props로 받은 progress를 직접 사용합니다.
  const displayProgress = isComplete ? 100 : progress

  return (
    <Dialog open={isOpen} modal={true}>
      <DialogContent className="sm:max-w-[425px] hideCloseButton">
        <DialogTitle>업데이트 다운로드</DialogTitle>
        <DialogDescription className="sr-only">업데이트 다운로드 진행 상황</DialogDescription>
        <Card className="border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {isComplete ? (
                <>다운로드 완료</>
              ) : (
                <>
                  <Download className="h-5 w-5 animate-bounce" />
                  버전 {version} 다운로드 중
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isComplete ? '완료' : '다운로드 중...'}</span>
                  <span>{Math.round(displayProgress)}%</span>
                </div>
                <Progress value={displayProgress} className="h-2" />
                {!isComplete && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatDownloadSpeed(downloadSpeed)}</span>
                    <span>
                      {formatBytes(transferred)} / {formatBytes(total)}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {isComplete
                  ? '새 버전이 성공적으로 다운로드되었습니다.'
                  : '업데이트를 다운로드하는 동안 프로그램이 백그라운드에서 계속 실행됩니다.'}
              </div>
            </div>
          </CardContent>
          {isComplete && (
            <CardFooter>
              <Button onClick={onClose} className="w-full">
                확인
              </Button>
            </CardFooter>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  )
}
