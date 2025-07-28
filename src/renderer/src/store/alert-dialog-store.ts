import { create } from 'zustand';

type AlertDialogType = 'confirm' | 'alert' | 'custom';
type AlertDialogVariant = 'default' | 'destructive';

interface AlertDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  type: AlertDialogType;
  variant: AlertDialogVariant;
  onConfirm?: () => void;
  onCancel?: () => void;

  // 액션
  openConfirm: (props: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: AlertDialogVariant;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => void;

  openAlert: (props: {
    title: string;
    description: string;
    confirmText?: string;
    variant?: AlertDialogVariant;
    onConfirm?: () => void;
  }) => void;

  openCustom: (props: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: AlertDialogVariant;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;

  close: () => void;
}

export const useAlertDialogStore = create<AlertDialogState>((set) => ({
  isOpen: false,
  title: '',
  description: '',
  confirmText: '확인',
  cancelText: '취소',
  type: 'confirm',
  variant: 'default',
  onConfirm: undefined,
  onCancel: undefined,

  openConfirm: (props) =>
    set({
      isOpen: true,
      title: props.title,
      description: props.description,
      confirmText: props.confirmText || '확인',
      cancelText: props.cancelText || '취소',
      type: 'confirm',
      variant: props.variant || 'default',
      onConfirm: props.onConfirm,
      onCancel: props.onCancel,
    }),

  openAlert: (props) =>
    set({
      isOpen: true,
      title: props.title,
      description: props.description,
      confirmText: props.confirmText || '확인',
      type: 'alert',
      variant: props.variant || 'default',
      onConfirm: props.onConfirm,
      onCancel: undefined,
    }),

  openCustom: (props) =>
    set({
      isOpen: true,
      title: props.title,
      description: props.description,
      confirmText: props.confirmText || '확인',
      cancelText: props.cancelText || '취소',
      type: 'custom',
      variant: props.variant || 'default',
      onConfirm: props.onConfirm,
      onCancel: props.onCancel,
    }),

  close: () =>
    set({
      isOpen: false,
    }),
}));
