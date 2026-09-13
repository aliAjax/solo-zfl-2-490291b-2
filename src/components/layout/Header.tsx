import { Keyboard, Plus, GitCompare, List, BarChart3, HardDrive } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function Header() {
  const { ui, openFormModal, setViewMode, clearCompareSelect, openImportExport } = useAppStore();
  const { viewMode, selectedForCompare } = ui;

  const compareCount = selectedForCompare.length;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-900/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="keycap !h-10 !w-10 !min-w-[40px] !rounded-lg !text-base">
              <Keyboard className="h-5 w-5" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="font-mono text-lg font-bold tracking-tight text-gradient-brass">
              KeyFeeling
            </h1>
            <p className="text-[11px] text-ink-500 font-mono">键 · 感 · 日 · 志</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-ink-800/80 border border-ink-700/60">
            <button
              onClick={() => clearCompareSelect()}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-brass-300/20 text-brass-100 border border-brass-300/30'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
              title="列表"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">列表</span>
            </button>
            <button
              onClick={() => compareCount >= 2 && setViewMode('compare')}
              disabled={compareCount < 2}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'compare'
                  ? 'bg-brass-300/20 text-brass-100 border border-brass-300/30'
                  : compareCount >= 2
                    ? 'text-ink-400 hover:text-ink-200'
                    : 'text-ink-600 cursor-not-allowed'
              }`}
              title="对比"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">对比</span>
              {compareCount > 0 && (
                <span
                  className={`ml-0.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold ${
                    compareCount >= 2
                      ? 'bg-moss-500 text-ink-900'
                      : 'bg-brass-300/30 text-brass-100'
                  }`}
                >
                  {compareCount}/2
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'stats'
                  ? 'bg-brass-300/20 text-brass-100 border border-brass-300/30'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
              title="统计"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">统计</span>
            </button>
          </div>

          <button
            onClick={openImportExport}
            className="p-2 rounded-lg text-ink-400 hover:text-brass-200 hover:bg-brass-300/10 transition-colors"
            title="数据导入导出"
          >
            <HardDrive className="h-4 w-4" />
          </button>

          <button
            onClick={() => openFormModal()}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建记录</span>
            <span className="sm:hidden">新建</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
