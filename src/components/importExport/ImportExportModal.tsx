import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Upload,
  Check,
  AlertTriangle,
  FileJson,
  ChevronDown,
  ChevronRight,
  Square,
  CheckSquare,
  RefreshCw,
  Copy,
  Sparkles,
  Shield,
  Database,
} from 'lucide-react';
import { useAppStore, useFilteredLogs } from '@/store/useAppStore';
import {
  parseImportData,
  buildValidatedLogs,
  exportToJson,
  downloadJsonFile,
  generateExportFilename,
  type ImportParseResult,
  type ValidatedLog,
  type DuplicateStrategy,
  type ImportApplyResult,
  EXPORT_FORMAT_MAGIC,
} from '@/utils/importExport';
import { SWITCH_TYPE_LABELS, SOUND_CHARACTER_LABELS } from '@/types';
import { getRatingGradient, formatDate } from '@/utils/helpers';

type ExportScope = 'all' | 'filtered';

interface LogPreviewCardProps {
  validated: ValidatedLog;
  checked: boolean;
  expanded: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  existingLog?: import('@/types').KeyboardLog;
}

function LogPreviewCard({
  validated,
  checked,
  expanded,
  onToggleCheck,
  onToggleExpand,
  existingLog,
}: LogPreviewCardProps) {
  const { log, isDuplicateExisting } = validated;

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${
        isDuplicateExisting
          ? 'border-brass-300/30 bg-brass-300/5'
          : 'border-ink-700/60 bg-ink-900/40'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggleCheck}
          className={`shrink-0 rounded transition-colors ${
            checked ? 'text-moss-400' : 'text-ink-500 hover:text-ink-300'
          }`}
        >
          {checked ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={onToggleExpand}
          className="shrink-0 text-ink-500 hover:text-ink-300 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-bold"
          style={{
            background: getRatingGradient(log.overallRating),
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          <span className="text-ink-950">{log.overallRating}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink-100 truncate">{log.name}</div>
          <div className="text-[11px] text-ink-500 font-mono truncate">
            {log.brand} {log.model} · {SWITCH_TYPE_LABELS[log.switchType]}
          </div>
        </div>

        {isDuplicateExisting && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-brass-300/15 text-brass-200 border border-brass-300/30">
            <Copy className="h-3 w-3" />
            ID 重复
          </span>
        )}
      </div>

      {expanded && (
        <div className="border-t border-ink-700/50 p-3 space-y-3 bg-ink-950/30">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <InfoRow label="入手日期" value={formatDate(log.purchaseDate)} />
            <InfoRow label="声音倾向" value={SOUND_CHARACTER_LABELS[log.soundCharacter]} />
            <InfoRow label="轴体" value={log.switchName} />
            <InfoRow label="润滑" value={log.switchLubed} />
            <InfoRow label="键帽" value={`${log.keycapMaterial} · ${log.keycapProfile}`} />
            <InfoRow label="定位板" value={`${log.plateMaterial}`} />
            <InfoRow label="外壳" value={log.caseMaterial} />
            <InfoRow label="填充" value={log.fillMaterial} />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MiniRating label="整体" value={log.overallRating} />
            <MiniRating label="回弹" value={log.reboundRating} />
            <MiniRating label="段落" value={log.tactilityRating} />
            <MiniRating label="疲劳" value={log.fatigueRating} invert />
          </div>

          {log.soundTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {log.soundTags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brass-300/10 text-brass-100 border border-brass-300/20"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {log.notes && (
            <div className="rounded-md bg-ink-900/60 border border-ink-700/40 p-2.5 text-[11px] text-ink-300 leading-relaxed whitespace-pre-wrap">
              {log.notes}
            </div>
          )}

          {isDuplicateExisting && existingLog && (
            <div className="rounded-md bg-brass-300/5 border border-brass-300/20 p-2.5 space-y-2">
              <div className="text-[10px] font-mono font-semibold text-brass-200 uppercase tracking-wider">
                现有记录对比
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-bold"
                  style={{ background: getRatingGradient(existingLog.overallRating) }}
                >
                  <span className="text-ink-950">{existingLog.overallRating}</span>
                </div>
                <div className="text-[11px] text-ink-300 truncate flex-1">
                  {existingLog.name} · {existingLog.brand} {existingLog.model}
                </div>
              </div>
              <div className="text-[10px] text-ink-500 font-mono">
                更新于 {formatDate(existingLog.updatedAt)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-500 font-mono uppercase tracking-wider text-[9px] mb-0.5">
        {label}
      </div>
      <div className="text-ink-200 truncate">{value || '—'}</div>
    </div>
  );
}

function MiniRating({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  return (
    <div className="rounded bg-ink-900/50 border border-ink-700/40 p-1.5 text-center">
      <div
        className={`font-mono font-bold text-sm ${
          invert ? (value <= 4 ? 'text-moss-400' : value <= 6 ? 'text-brass-200' : 'text-wine-400')
          : (value >= 8 ? 'text-moss-400' : value >= 6 ? 'text-brass-200' : 'text-wine-400')
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] font-mono text-ink-500 uppercase">{label}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const styles: Record<string, string> = {
    default: 'bg-ink-800/80 border-ink-700/60 text-ink-200',
    success: 'bg-moss-500/10 border-moss-500/30 text-moss-400',
    warning: 'bg-brass-300/10 border-brass-300/30 text-brass-200',
    danger: 'bg-wine-500/10 border-wine-500/30 text-wine-400',
    info: 'bg-slateblue-500/10 border-slateblue-500/30 text-slateblue-300',
  };
  return (
    <div className={`rounded-lg border p-2.5 text-center ${styles[variant]}`}>
      <div className="text-lg font-mono font-bold leading-none">{value}</div>
      <div className="text-[9px] font-mono uppercase opacity-70 mt-1">{label}</div>
    </div>
  );
}

export default function ImportExportModal() {
  const { ui, closeImportExport, logs, importLogs } = useAppStore();
  const filteredLogs = useFilteredLogs();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(null);
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOpen = ui.importExportModalOpen;

  const validated = useMemo(() => {
    if (!parseResult) return { newLogs: [], duplicateWithExisting: [] };
    return buildValidatedLogs(parseResult.fileValidLogs, logs);
  }, [parseResult, logs]);

  const totalValidForDisplay = parseResult ? parseResult.fileValidLogs.length : 0;

  const allChecked = useMemo(() => {
    return totalValidForDisplay > 0 && checkedIds.size === totalValidForDisplay;
  }, [totalValidForDisplay, checkedIds.size]);

  const checkedCount = checkedIds.size;
  const checkedNewCount = useMemo(() => {
    return validated.newLogs.filter((v) => checkedIds.has(v.log.id)).length;
  }, [validated.newLogs, checkedIds]);
  const checkedDupCount = useMemo(() => {
    return validated.duplicateWithExisting.filter((v) => checkedIds.has(v.log.id)).length;
  }, [validated.duplicateWithExisting, checkedIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeImportExport();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeImportExport]);

  useEffect(() => {
    if (isOpen) {
      setParseResult(null);
      setImportError(null);
      setApplyResult(null);
      setStrategy('skip');
      setCheckedIds(new Set());
      setExpandedIds(new Set());
      setExportScope('all');
      setActiveTab('export');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const handleExport = useCallback(() => {
    const source = exportScope === 'all' ? logs : filteredLogs;
    const json = exportToJson(source);
    downloadJsonFile(json, generateExportFilename());
  }, [logs, filteredLogs, exportScope]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImportError(null);
      setParseResult(null);
      setApplyResult(null);
      setCheckedIds(new Set());
      setExpandedIds(new Set());

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const existingIds = logs.map((l) => l.id);
          const result = parseImportData(content, existingIds);
          setParseResult(result);

          const allIds = result.fileValidLogs.map((l) => l.id);
          setCheckedIds(new Set(allIds));
        } catch (err) {
          setImportError(err instanceof Error ? err.message : String(err));
        }
      };
      reader.onerror = () => {
        setImportError('文件读取失败');
      };
      reader.readAsText(file);
    },
    [logs],
  );

  const handleConfirmImport = useCallback(() => {
    if (checkedIds.size === 0 || !parseResult) return;

    const selectedIds = Array.from(checkedIds);
    const result = importLogs(
      selectedIds,
      parseResult.fileValidLogs,
      validated.duplicateWithExisting,
      strategy,
    );
    setApplyResult(result);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [checkedIds, parseResult, importLogs, validated.duplicateWithExisting, strategy]);

  const resetImport = useCallback(() => {
    setParseResult(null);
    setImportError(null);
    setApplyResult(null);
    setCheckedIds(new Set());
    setExpandedIds(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const toggleAll = useCallback(() => {
    if (!parseResult) return;
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(parseResult.fileValidLogs.map((l) => l.id)));
    }
  }, [parseResult, allChecked]);

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const existingLogMap = new Map(logs.map((l) => [l.id, l]));

  const renderExportSection = () => (
    <div className="space-y-5 animate-fadeIn">
      <div className="rounded-xl bg-ink-900/60 border border-ink-700/60 p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-brass-300/10 text-brass-200">
            <FileJson className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-mono text-sm font-semibold text-ink-100 mb-1">
                导出为 JSON 文件
              </h3>
              <p className="text-xs text-ink-400">
                将键盘记录导出为 KeyFeeling 标准 JSON 格式，包含完整的元信息和版本号，便于备份或迁移到其他设备。
              </p>
            </div>

            <div className="flex items-center gap-2 p-0.5 rounded-lg bg-ink-800/80 border border-ink-700/60 w-fit">
              <button
                onClick={() => setExportScope('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  exportScope === 'all'
                    ? 'bg-brass-300/20 text-brass-100 border border-brass-300/30'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                全部记录
                <span className="font-mono text-[10px] opacity-70">({logs.length})</span>
              </button>
              <button
                onClick={() => setExportScope('filtered')}
                disabled={filteredLogs.length === logs.length}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  exportScope === 'filtered'
                    ? 'bg-brass-300/20 text-brass-100 border border-brass-300/30'
                    : 'text-ink-400 hover:text-ink-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                当前筛选
                <span className="font-mono text-[10px] opacity-70">({filteredLogs.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink-800 border border-ink-700/60 text-ink-400">
                格式: {EXPORT_FORMAT_MAGIC}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink-800 border border-ink-700/60 text-ink-400">
                包含: meta + data
              </span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        className="w-full btn-primary justify-center"
      >
        <Download className="h-4 w-4" />
        导出 JSON 文件
        <span className="font-mono text-xs opacity-70 ml-1">
          ({exportScope === 'all' ? logs.length : filteredLogs.length})
        </span>
      </button>

      <p className="text-[11px] text-ink-500 text-center leading-relaxed">
        导出文件为标准 JSON，包含格式版本号、导出时间、记录数量和完整数据，可直接用于导入或程序解析
      </p>
    </div>
  );

  const renderResultSection = () => {
    if (!applyResult) return null;
    const { stats } = applyResult;
    const totalEffective = stats.added + stats.overwritten + stats.regenerated;

    return (
      <div className="rounded-xl bg-moss-500/10 border border-moss-500/30 p-5 text-center animate-fadeIn">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-moss-500/20 text-moss-400 mb-3">
          <Check className="h-6 w-6" />
        </div>
        <h3 className="font-mono text-sm font-semibold text-moss-300 mb-1">
          导入完成
        </h3>
        <p className="text-xs text-ink-400 mb-4">
          共处理 {checkedCount} 条选中记录
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatCard label="新增" value={stats.added} variant="success" />
          <StatCard label="覆盖" value={stats.overwritten} variant="info" />
          <StatCard label="新ID" value={stats.regenerated} variant="warning" />
          <StatCard label="跳过" value={stats.skipped} variant="default" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-moss-500/15 text-moss-300 border border-moss-500/30 text-[11px] font-mono mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          实际写入 {totalEffective} 条记录
        </div>

        <div className="flex gap-2 justify-center">
          <button
            onClick={resetImport}
            className="btn-secondary text-sm"
          >
            继续导入
          </button>
          <button
            onClick={closeImportExport}
            className="btn-primary text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    );
  };

  const renderImportParseSection = () => {
    if (!parseResult) return null;
    const fileDupCount = parseResult.fileInternalDuplicates.length;
    const invalidCount = parseResult.fileInvalidItems.length;
    const existingDupCount = validated.duplicateWithExisting.length;
    const pureNewCount = validated.newLogs.length;

    return (
      <div className="space-y-4 animate-fadeIn">
        {parseResult.envelope && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slateblue-500/10 border border-slateblue-500/25 text-[11px] font-mono">
            <Shield className="h-3.5 w-3.5 text-slateblue-300 shrink-0" />
            <span className="text-slateblue-300">
              KeyFeeling 导出文件 v{parseResult.envelope.version}
            </span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-400">
              {formatDate(parseResult.envelope.exportedAt)} 导出
            </span>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2">
          <StatCard label="文件内" value={parseResult.totalParsed} />
          <StatCard label="无效" value={invalidCount} variant="danger" />
          <StatCard label="重复(文件内)" value={fileDupCount} variant="warning" />
          <StatCard label="重复(现有)" value={existingDupCount} variant="warning" />
          <StatCard label="全新" value={pureNewCount} variant="success" />
        </div>

        {invalidCount > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-semibold text-wine-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              解析错误 ({invalidCount} 条)
            </h4>
            <div className="rounded-lg bg-wine-500/10 border border-wine-500/20 p-3 max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin">
              {parseResult.fileInvalidItems.slice(0, 10).map((item, i) => (
                <div
                  key={i}
                  className="text-[11px] flex items-start gap-2"
                >
                  <span className="text-ink-600 font-mono shrink-0">#{item.index}</span>
                  <span className="text-wine-300">{item.reason}</span>
                </div>
              ))}
              {invalidCount > 10 && (
                <div className="text-[11px] text-ink-500 pt-1 border-t border-ink-700/40">
                  ...还有 {invalidCount - 10} 条错误
                </div>
              )}
            </div>
          </div>
        )}

        {fileDupCount > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-semibold text-brass-300 uppercase tracking-wider flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              文件内重复 ID ({fileDupCount} 条，已自动去除)
            </h4>
            <div className="rounded-lg bg-brass-300/5 border border-brass-300/20 p-3 max-h-24 overflow-y-auto space-y-1 scrollbar-thin">
              {parseResult.fileInternalDuplicates.slice(0, 5).map((item, i) => (
                <div
                  key={i}
                  className="text-[11px] flex items-start gap-2"
                >
                  <span className="text-ink-600 font-mono shrink-0">#{item.index}</span>
                  <span className="text-brass-200 font-mono break-all">{item.id}</span>
                </div>
              ))}
              {fileDupCount > 5 && (
                <div className="text-[11px] text-ink-500 pt-1 border-t border-ink-700/40">
                  ...还有 {fileDupCount - 5} 条重复
                </div>
              )}
            </div>
          </div>
        )}

        {totalValidForDisplay > 0 && (
          <>
            <div className="divider" />

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-ink-300 uppercase tracking-wider">
                记录预览 ({totalValidForDisplay} 条)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAll}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    allChecked
                      ? 'bg-moss-500/15 text-moss-300 border border-moss-500/30'
                      : 'bg-ink-800 text-ink-400 border border-ink-700/60 hover:text-ink-200'
                  }`}
                >
                  {allChecked ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {allChecked ? '取消全选' : '全选'}
                </button>
                <span className="text-[11px] font-mono text-ink-500">
                  已选 <span className="text-brass-200">{checkedCount}</span>
                  <span className="mx-1">·</span>
                  新 <span className="text-moss-400">{checkedNewCount}</span>
                  <span className="mx-1">·</span>
                  重 <span className="text-brass-300">{checkedDupCount}</span>
                </span>
              </div>
            </div>

            {existingDupCount > 0 && (
              <div className="flex items-center gap-2 p-0.5 rounded-lg bg-ink-800/80 border border-ink-700/60 w-fit text-xs">
                <span className="px-2 py-1 text-ink-500 shrink-0">重复策略:</span>
                <button
                  onClick={() => setStrategy('skip')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    strategy === 'skip'
                      ? 'bg-wine-500/15 text-wine-300 border border-wine-500/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <Shield className="h-3 w-3" />
                  跳过
                </button>
                <button
                  onClick={() => setStrategy('overwrite')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    strategy === 'overwrite'
                      ? 'bg-slateblue-500/15 text-slateblue-300 border border-slateblue-500/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <RefreshCw className="h-3 w-3" />
                  覆盖
                </button>
                <button
                  onClick={() => setStrategy('regenerate')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    strategy === 'regenerate'
                      ? 'bg-brass-300/15 text-brass-200 border border-brass-300/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  新ID
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1 -mr-1">
              {validated.newLogs.map((v) => (
                <LogPreviewCard
                  key={v.log.id}
                  validated={v}
                  checked={checkedIds.has(v.log.id)}
                  expanded={expandedIds.has(v.log.id)}
                  onToggleCheck={() => toggleCheck(v.log.id)}
                  onToggleExpand={() => toggleExpand(v.log.id)}
                />
              ))}
              {validated.duplicateWithExisting.map((v) => (
                <LogPreviewCard
                  key={v.log.id}
                  validated={v}
                  checked={checkedIds.has(v.log.id)}
                  expanded={expandedIds.has(v.log.id)}
                  onToggleCheck={() => toggleCheck(v.log.id)}
                  onToggleExpand={() => toggleExpand(v.log.id)}
                  existingLog={existingLogMap.get(v.log.id)}
                />
              ))}
            </div>

            <div className="divider" />

            <div className="flex gap-2">
              <button
                onClick={resetImport}
                className="flex-1 btn-secondary justify-center"
              >
                重新选择文件
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={checkedCount === 0}
                className="flex-1 btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                确认导入 ({checkedCount})
              </button>
            </div>

            <p className="text-[11px] text-ink-500 text-center leading-relaxed">
              勾选要导入的记录，确认后写入本地存储。重复 ID 可根据策略处理：
              {existingDupCount > 0 && (
                <>
                  <br />
                  <span className="text-wine-300">跳过</span>=保留现有 ·
                  <span className="text-slateblue-300"> 覆盖</span>=更新现有 ·
                  <span className="text-brass-200"> 新ID</span>=作为新记录导入
                </>
              )}
            </p>
          </>
        )}

        {totalValidForDisplay === 0 && invalidCount > 0 && (
          <div className="rounded-lg bg-wine-500/10 border border-wine-500/30 p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-wine-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-wine-300 mb-1">无有效记录</p>
            <p className="text-[11px] text-ink-400">
              文件中没有可以导入的有效记录，请检查文件格式
            </p>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && closeImportExport()}
    >
      <div className="modal-surface max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 bg-gradient-to-b from-ink-800/98 to-ink-800/90 backdrop-blur-sm">
          <div>
            <h2 className="font-mono text-lg font-bold text-gradient-brass">
              数据导入导出
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              管理你的键盘手感记录数据 · JSON 格式
            </p>
          </div>
          <button
            onClick={closeImportExport}
            className="p-2 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-ink-700/60">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-brass-100 border-b-2 border-brass-300 bg-brass-300/5'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Download className="h-4 w-4 inline mr-2" />
            导出数据
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-brass-100 border-b-2 border-brass-300 bg-brass-300/5'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            导入数据
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'export' && renderExportSection()}

          {activeTab === 'import' && (
            <div className="space-y-4 animate-fadeIn">
              {applyResult ? (
                renderResultSection()
              ) : (
                <>
                  <div className="rounded-xl border border-dashed border-ink-600 bg-ink-900/40 p-6 text-center hover:border-brass-300/40 hover:bg-brass-300/5 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="import-file-input"
                    />
                    <label
                      htmlFor="import-file-input"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <div className="p-3 rounded-lg bg-ink-800 text-ink-400 mb-3">
                        <Upload className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-medium text-ink-200 mb-1">
                        点击选择 JSON 文件
                      </span>
                      <span className="text-xs text-ink-500">
                        支持 KeyFeeling 导出格式或纯数组格式
                      </span>
                    </label>
                  </div>

                  {importError && (
                    <div className="rounded-lg bg-wine-500/10 border border-wine-500/30 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-wine-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-wine-300 mb-1">
                            解析失败
                          </p>
                          <p className="text-xs text-ink-400">{importError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {renderImportParseSection()}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
