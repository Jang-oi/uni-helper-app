import { create } from 'zustand'

interface ScheduleDialogData {
  srIdx?: string
  requestTitle?: string
  date?: Date
}

interface ScheduleStore {
  isAddDialogOpen: boolean
  dialogData: ScheduleDialogData | null
  openAddDialog: (data?: ScheduleDialogData) => void
  closeAddDialog: () => void
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  isAddDialogOpen: false,
  dialogData: null,
  openAddDialog: (data) =>
    set({
      isAddDialogOpen: true,
      dialogData: data || null
    }),
  closeAddDialog: () =>
    set({
      isAddDialogOpen: false,
      dialogData: null
    })
}))
