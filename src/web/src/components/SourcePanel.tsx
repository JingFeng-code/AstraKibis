import { ChevronDown, ChevronRight } from "lucide-react";
import { formatInterval } from "../lib/sources.ts";
import { t, uiMessage } from "../lib/i18n.ts";

import type { ComponentType } from "react";

export type SourceGroup = { key: string; label: string; sources: { id: string; name: string; items: number; interval_sec: number; enabled: boolean }[] };

/** Quick views + source tree. Shared by the desktop rail and the mobile filter sheet. */
export function SourcePanel({ views, preset, onPickPreset, grouped, source, onPickSource, showAllSources, onToggleShowAll, collapsedGroups, onToggleGroup }: {
  views: { key: string; label: string; icon: ComponentType<{ size?: number; className?: string }> }[];
  preset: string;
  onPickPreset: (key: string) => void;
  grouped: SourceGroup[];
  source: string;
  onPickSource: (id: string) => void;
  showAllSources: boolean;
  onToggleShowAll: () => void;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
}) {
  return <>
    <div className="pt-1">
      <div className="mb-1.5 flex items-center justify-between px-2">
        <span className="rail-section-label">{t("快捷视图")}</span>
      </div>
      <div className="space-y-0.5">
        {views.map((view) => (
          <button key={view.key} type="button" onClick={() => onPickPreset(view.key)}
            aria-current={preset === view.key ? "page" : undefined}
            className={
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors " +
              (preset === view.key
                ? "bg-brand-subtle font-semibold text-accent"
                : "font-medium text-ink-600 hover:bg-canvas-subtle/60 hover:text-ink-950")
            }
          >
            <view.icon size={13} className={preset === view.key ? "text-accent" : "text-ink-400"} />
            {view.label}
          </button>
        ))}
      </div>
    </div>

    <div className="border-t border-ink-200 pt-3">
      <div className="mb-1.5 flex items-center justify-between px-2">
        <span className="rail-section-label">{t("数据源")}</span>
        <button type="button" onClick={onToggleShowAll} className="text-[11px] text-ink-400 hover:text-ink-700">
          {showAllSources ? t("隐藏禁用") : t("显示全部")}
        </button>
      </div>
      <button type="button" onClick={() => onPickSource("")}
        className={
          "mb-1 w-full rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
          (source === "" ? "bg-canvas-subtle font-semibold text-ink-950" : "font-medium text-ink-600 hover:bg-canvas-subtle/60")
        }
      >
        {t("全部来源")}
      </button>
      {grouped.map((group) => {
        const collapsed = collapsedGroups[group.key] ?? !group.sources.some((item) => item.id === source);
        const total = group.sources.reduce((sum, item) => sum + item.items, 0);
        return (
          <div key={group.key} className="mb-1">
            <button type="button" aria-expanded={!collapsed} onClick={() => onToggleGroup(group.key)}
              className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-400 hover:text-ink-700">
              {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
              <span className="font-mono tabular-nums">{total}</span>
            </button>
            {!collapsed && (
              <div className="space-y-0.5">
                {group.sources.map((item) => (
                  <button key={item.id} type="button" onClick={() => onPickSource(item.id === source ? "" : item.id)}
                    className={
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
                      (source === item.id ? "bg-brand-subtle font-semibold text-accent" : "text-ink-600 hover:bg-canvas-subtle/60") +
                      (item.enabled ? "" : " text-ink-500")
                    }
                    title={item.id + " · " + t("采集周期 {interval}", { interval: formatInterval(item.interval_sec) })}
                  >
                    <span className="min-w-0 truncate">{uiMessage(item.name)}</span>
                    <span className="ml-1.5 shrink-0 font-mono text-[11px] tabular-nums text-ink-400">{item.items}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </>;
}

