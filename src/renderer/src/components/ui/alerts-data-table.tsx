import * as React from 'react'
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'
import { ArrowUpDown, CalendarPlus, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// AlertItem 타입 정의 (alerts-page.tsx와 동일하게 유지)
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

  if (statusLower.includes('처리')) {
    return 'default'
  } else if (statusLower.includes('요청')) {
    return 'secondary'
  } else if (statusLower.includes('고객사')) {
    return 'destructive'
  } else {
    return 'outline'
  }
}

// 텍스트 자르기 함수
function truncateText(text: string, maxLength: number) {
  if (!text || text.length <= maxLength) return { isTruncated: false, displayText: text || '' }
  return { isTruncated: true, displayText: text.slice(0, maxLength) + '...' }
}

const getRowStyle = (row: any) => {
  if (row.original.isUrgent) return 'bg-red-50 dark:bg-red-950/20'
  if (row.original.isDelayed) return 'bg-amber-50 dark:bg-amber-950/20'
  if (row.original.isPending) return 'bg-blue-50 dark:bg-blue-950/20'
  return ''
}

// ✨ 2. 컬럼 정의 재설계 (각 컬럼에 독립적인 정렬 로직 부여)
const columns: ColumnDef<AlertItem>[] = [
  {
    id: 'priority',
    header: ({ column }) => (
      <Button variant="ghost" className="w-full" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        우선순위
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const item = row.original
      if (item.isUrgent) return <span className="text-red-600 font-medium">긴급</span>
      if (item.isDelayed) return <span className="text-amber-600 font-medium">지연</span>
      if (item.isPending) return <span className="text-blue-600 font-medium">미처리</span>
      return <span className="text-muted-foreground">-</span>
    },
    sortingFn: (rowA, rowB) => getPriorityFlagScore(rowA.original) - getPriorityFlagScore(rowB.original),
    size: 20
  },
  {
    accessorKey: 'CM_NAME',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        고객사
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    size: 20
  },
  {
    accessorKey: 'REQ_TITLE',
    header: '제목'
  },
  {
    accessorKey: 'STATUS',
    header: ({ column }) => (
      <Button variant="ghost" className="w-full" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        상태
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <Badge variant={getStatusVariant(row.original.STATUS)}>{row.original.STATUS}</Badge>,
    sortingFn: (rowA, rowB) => getStatusScore(rowA.original) - getStatusScore(rowB.original),
    size: 20
  },
  {
    accessorKey: 'WRITER',
    header: '처리자',
    size: 20
  },
  {
    accessorKey: 'REQ_DATE_ALL',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        요청일시
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    size: 20
  },
  {
    id: 'add_schedule',
    cell: () => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alert('배포일정 추가 로직 연결 필요')}>
              <CalendarPlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>배포일정 추가</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    size: 20
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => window.electron.ipcRenderer.invoke('open-request', row.original.SR_IDX)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>상세페이지 이동</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    size: 20
  }
]

export function AlertsDataTable({ data }: { data: AlertItem[] }) {
  // ✨ 3. 기본 정렬을 다중 정렬로 설정 (상태 점수 > 우선순위 점수 > 최신순)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'status', desc: true },
    { id: 'priority', desc: true },
    { id: 'REQ_DATE_ALL', desc: true }
  ])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting }
  })

  return (
    <div className="rounded-md border">
      <Table className={'w-[400px]'}>
        <TableHeader className="sticky top-0 bg-background z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={getRowStyle(row)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2 px-2 text-xs truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                데이터가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
