import { useState } from 'react'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { CalendarPlus, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useScheduleStore } from '@/store/schedule-store'

export interface AlertItem {
  SR_IDX: string
  REQ_TITLE: string
  CM_NAME: string
  STATUS: string
  WRITER: string
  REQ_DATE_ALL: string
  isUrgent: boolean
  isDelayed: boolean
  isPending: boolean
}

const getPriorityFlagScore = (item: AlertItem): number => {
  if (item.isUrgent) return 3
  if (item.isDelayed) return 2
  if (item.isPending) return 1
  return 0
}

const getStatusScore = (item: AlertItem): number => {
  if (item.STATUS.includes('고객사답변')) return 2
  if (item.STATUS.includes('처리중')) return 1
  return 0
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusLower = status.toLowerCase()
  if (statusLower.includes('처리')) return 'default'
  if (statusLower.includes('요청')) return 'secondary'
  if (statusLower.includes('고객사')) return 'destructive'
  return 'outline'
}

function truncateText(text: string, maxLength: number) {
  if (!text || text.length <= maxLength) return { isTruncated: false, displayText: text || '' }
  return { isTruncated: true, displayText: text.slice(0, maxLength) + '...' }
}

const getRowStyle = (row: any) => {
  if (row.original.isUrgent) return 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20'
  if (row.original.isDelayed) return 'bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20'
  if (row.original.isPending) return 'bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/20'
  return 'hover:bg-muted/30'
}

const initialSorting: SortingState = []
export function AlertsDataTable({ data }: { data: AlertItem[] }) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const { openAddDialog } = useScheduleStore()

  const columns: ColumnDef<AlertItem>[] = [
    {
      id: 'priority',
      accessorFn: (row) => getPriorityFlagScore(row),
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs font-medium w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          우선순위
        </Button>
      ),
      cell: ({ row }) => {
        const item = row.original
        if (item.isUrgent)
          return (
            <Badge variant="destructive" className="text-[11px] px-1 py-0 h-4">
              긴급
            </Badge>
          )
        if (item.isDelayed) return <Badge className="text-[11px] px-1 py-0 h-4 bg-amber-100 text-amber-800 hover:bg-amber-100">지연</Badge>
        if (item.isPending)
          return (
            <Badge variant="outline" className="text-[11px] px-1 py-0 h-4 border-blue-200 text-blue-700">
              미처리
            </Badge>
          )
        return <span className="text-[10px] text-muted-foreground">-</span>
      },
      size: 40
    },
    {
      accessorKey: 'CM_NAME',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs font-medium w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          고객사
        </Button>
      ),
      cell: ({ row }) => {
        const { displayText, isTruncated } = truncateText(row.original.CM_NAME, 8)
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[11px] font-medium cursor-default block">{displayText}</span>
              </TooltipTrigger>
              {isTruncated && (
                <TooltipContent>
                  <p>{row.original.CM_NAME}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 70
    },
    {
      accessorKey: 'REQ_TITLE',
      header: () => (
        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs font-medium w-full justify-start">
          제목
        </Button>
      ),
      cell: ({ row }) => {
        const { displayText } = truncateText(row.original.REQ_TITLE, 38)
        return (
          <button
            className="text-xs cursor-pointer block leading-tight text-left hover:text-blue-600 hover:underline transition-colors"
            onClick={() => window.electron.ipcRenderer.invoke('open-request', row.original.SR_IDX)}
          >
            {displayText}
          </button>
        )
      },
      size: 200
    },
    {
      accessorKey: 'STATUS',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs font-medium w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          상태
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.STATUS)} className="text-[10px] px-1 py-0 h-4">
          {row.original.STATUS}
        </Badge>
      ),
      sortingFn: (rowA, rowB) => getStatusScore(rowA.original) - getStatusScore(rowB.original),
      size: 50
    },
    {
      accessorKey: 'WRITER',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs font-medium w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          처리자
        </Button>
      ),
      cell: ({ row }) => {
        const { displayText, isTruncated } = truncateText(row.original.WRITER, 6)
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs cursor-default block">{displayText}</span>
              </TooltipTrigger>
              {isTruncated && (
                <TooltipContent>
                  <p>{row.original.WRITER}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 30
    },
    {
      accessorKey: 'REQ_DATE_ALL',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs font-medium w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          요청일시
        </Button>
      ),
      cell: ({ row }) => {
        const dateText = row.original.REQ_DATE_ALL
        const [datePart, timePart] = dateText.includes(' ') ? dateText.split(' ') : [dateText, '']
        return (
          <div className="text-xs cursor-default">
            <div className="font-medium">
              {datePart} {timePart}
            </div>
          </div>
        )
      },
      size: 85
    },
    {
      id: 'add_schedule',
      header: () => (
        <Button variant="ghost" size="sm" className="h-6 px-1 text-xs font-medium w-full justify-start">
          배포
        </Button>
      ),
      cell: ({ row }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={(e: any) => {
                  e.stopPropagation()
                  openAddDialog({ srIdx: row.original.SR_IDX, requestTitle: row.original.CM_NAME })
                }}
              >
                <CalendarPlus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>배포일정 추가</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      size: 35
    }
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting }
  })

  return (
    <div className="w-full">
      <div className="flex items-center justify-end py-1">
        <Button variant="ghost" size="sm" onClick={() => setSorting(initialSorting)} className="h-7 text-xs">
          <RotateCcw className="mr-1.5 h-3 w-3" />
          정렬 초기화
        </Button>
      </div>
      <ScrollArea className="h-[calc(64vh-80px)]">
        <Table className="w-full" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-8 px-2 text-left font-medium text-muted-foreground border-r last:border-r-0 bg-muted/50"
                    style={{
                      width: `${header.getSize()}px`,
                      minWidth: `${header.getSize()}px`,
                      maxWidth: `${header.getSize()}px`
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={`transition-colors ${getRowStyle(row)} border-b last:border-b-0`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-1.5 px-2 text-xs border-r last:border-r-0 align-top overflow-hidden"
                      style={{
                        width: `${cell.column.getSize()}px`,
                        minWidth: `${cell.column.getSize()}px`,
                        maxWidth: `${cell.column.getSize()}px`
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-16 text-center text-muted-foreground text-xs">
                  데이터가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
