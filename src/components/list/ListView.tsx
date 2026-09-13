import FilterBar from './FilterBar';
import KeyboardCard from './KeyboardCard';
import { useFilteredLogs, useAppStore } from '@/store/useAppStore';
import { FolderOpen, Plus } from 'lucide-react';

export default function ListView() {
  const logs = useFilteredLogs();
  const { openFormModal, ui } = useAppStore();
  const totalLogs = useAppStore((s) => s.logs.length);

  return (
    <div className="space-y-5">
      <FilterBar />

      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-mono text-ink-500">
          显示 <span className="text-brass-300">{logs.length}</span> 条记录
          {logs.length !== totalLogs && (
            <span className="text-ink-600">（共 {totalLogs} 条）</span>
          )}
        </p>
        {ui.selectedForCompare.length > 0 && (
          <p className="text-xs font-mono text-ink-400">
            已选 <span className="text-brass-300 font-bold">{ui.selectedForCompare.length}</span> / 2 条用于对比
            {ui.selectedForCompare.length < 2 && '，再选一条后进入对比视图'}
          </p>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="keycap !h-14 !w-14 !min-w-[56px] !rounded-xl !text-xl mb-4 opacity-60">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="font-mono text-base font-semibold text-ink-200 mb-2">
            没有找到匹配的记录
          </h3>
          <p className="text-sm text-ink-500 mb-6 max-w-sm">
            尝试调整筛选条件，或者创建你的第一条键盘手感日志吧～
          </p>
          <button onClick={() => openFormModal()} className="btn-primary">
            <Plus className="h-4 w-4" />
            创建第一条记录
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
          {logs.map((log, i) => (
            <KeyboardCard key={log.id} log={log} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
