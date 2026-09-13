import Header from '@/components/layout/Header';
import ListView from '@/components/list/ListView';
import CompareView from '@/components/compare/CompareView';
import StatsView from '@/components/stats/StatsView';
import FormModal from '@/components/form/FormModal';
import DetailModal from '@/components/detail/DetailModal';
import ImportExportModal from '@/components/importExport/ImportExportModal';
import { useAppStore } from '@/store/useAppStore';
import { GitCompare } from 'lucide-react';

export default function Home() {
  const { ui, setViewMode, logs } = useAppStore();
  const { viewMode, selectedForCompare } = ui;

  const canCompare = selectedForCompare.length >= 2;
  const showCompareBanner = canCompare && viewMode === 'list';

  const renderView = () => {
    switch (viewMode) {
      case 'compare':
        return <CompareView />;
      case 'stats':
        return <StatsView />;
      case 'list':
      default:
        return <ListView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {showCompareBanner && (
        <div className="sticky top-16 z-30 border-b border-brass-300/25 bg-gradient-to-r from-brass-300/10 via-brass-300/15 to-brass-300/10 backdrop-blur-lg animate-fadeIn">
          <div className="container flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {selectedForCompare.slice(0, 2).map((id, i) => {
                  const log = logs.find((l) => l.id === id);
                  return (
                    <div
                      key={id}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold border-2 border-ink-900 ${
                        i === 0
                          ? 'bg-slateblue-500 text-ink-950'
                          : 'bg-wine-400 text-ink-950'
                      }`}
                      title={log?.name}
                    >
                      {log?.overallRating ?? '?'}
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-xs font-mono font-semibold text-brass-100">
                  已选择 2 把键盘
                </div>
                <div className="text-[11px] text-ink-400">
                  点击右侧按钮开始对比它们的手感差异
                </div>
              </div>
            </div>
            <button onClick={() => setViewMode('compare')} className="btn-primary animate-pulseGlow">
              <GitCompare className="h-4 w-4" />
              开始对比
            </button>
          </div>
        </div>
      )}

      <main className="container flex-1 py-6 sm:py-8 w-full">
        {renderView()}
      </main>

      <footer className="border-t border-ink-700/40 py-6 mt-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-ink-500">
          <div className="flex items-center gap-2">
            <span className="keycap !h-6 !text-[10px]">K</span>
            <span>KeyFeeling · 键盘手感日志</span>
          </div>
          <div className="flex items-center gap-4">
            <span>数据保存在本地浏览器</span>
            <span className="text-ink-600">·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      <FormModal />
      <DetailModal />
      <ImportExportModal />
    </div>
  );
}
