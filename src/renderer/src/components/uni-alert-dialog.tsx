import { useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useAlertDialogStore } from '@/store/alert-dialog-store'

export function UniAlertDialog() {
  const { isOpen, title, description, confirmText, cancelText, type, onConfirm, onCancel, close, variant } = useAlertDialogStore()

  // 컴포넌트가 언마운트될 때 대화상자 닫기
  useEffect(() => {
    return () => {
      close()
    }
  }, [close])

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    close()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    close()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {type !== 'alert' && <AlertDialogCancel onClick={handleCancel}>{cancelText}</AlertDialogCancel>}
          <AlertDialogAction onClick={handleConfirm} className={variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
