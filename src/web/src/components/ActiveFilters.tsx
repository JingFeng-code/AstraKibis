import { X } from "lucide-react";
import type { FeedState } from "../lib/feedQuery.ts";
import { qualityFields, qualityLabel } from "../lib/resourceQuality.ts";
import { t } from "../lib/i18n.ts";
import { KIND_LABEL, OBTAIN_LABEL } from "../../../shared/taxonomy.ts";

export type FilterKey = "search" | "source" | "category" | "lang" | "price" | "obtain" | "range" | "score" | "kind" | "unread" | "freeType" | "regionHint" | "billingRisk" | "cardRequirement" | "resourceNature";

type Chip = { key: FilterKey; value?: string; label: string; tone?: "accent" | "plain" };

export function activeFilterChips(
  state: FeedState,
  labels: { sourceName: (id: string) => string; categoryName: (category: string) => string },
): Chip[] {
  const chips: Chip[] = [];
  if (state.search.trim()) chips.push({ key: "search", label: t("搜索：{q}", { q: state.search.trim() }), tone: "plain" });
  if (state.source) chips.push({ key: "source", label: t("来源：{name}", { name: labels.sourceName(state.source) }) });
  for (const category of state.categories) chips.push({ key: "category", value: category, label: t("分类：{name}", { name: labels.categoryName(category) }) });
  if (state.lang !== "all") chips.push({ key: "lang", label: t("语言：{v}", { v: state.lang === "zh" ? t("仅看中文") : t("仅看英文") }) });
  if (state.kindFilter !== "auto") chips.push({ key: "kind", label: t("形态：{v}", { v: state.kindFilter === "all" ? t("全部") : t(KIND_LABEL[state.kindFilter] ?? state.kindFilter) }) });
  if (state.obtain !== "auto") chips.push({ key: "obtain", label: t("方式：{v}", { v: state.obtain === "all" ? t("全部") : t(OBTAIN_LABEL[state.obtain] ?? state.obtain) }) });
  if (state.priceCap !== "auto") chips.push({ key: "price", label: t("价格：{v}", { v: state.priceCap === "all" ? t("不限") : state.priceCap === "free" ? t("免費宣稱（未查證）") : t("≤ {n} 人民幣", { n: state.priceCap }) }) });
  if (state.range !== "auto") chips.push({ key: "range", label: t("时间：{v}", { v: state.range === "all" ? t("不限") : state.range === "1d" ? t("1 天内") : t("{n} 天内", { n: state.range.replace("d", "") }) }) });
  if (state.minScore !== "all") chips.push({ key: "score", label: t("评分：≥{n}", { n: state.minScore }) });
  if (state.unreadOnly) chips.push({ key: "unread", label: t("仅未读") });
  for (const [key,label] of qualityFields) if (state[key] !== "all") chips.push({key,label: t(label) + "：" + qualityLabel(key,state[key])});
  return chips;
}

/** Active filters as removable chips; the × is a real button so keyboard and screen readers can drop one condition. */
export function ActiveFilters({ state, onRemove, onReset, sourceName, categoryName }: {
  state: FeedState;
  onRemove: (key: FilterKey, value?: string) => void;
  onReset: () => void;
  sourceName: (id: string) => string;
  categoryName: (category: string) => string;
}) {
  const chips = activeFilterChips(state, { sourceName, categoryName });
  if (!chips.length) return null;
  return <div className="filter-chips" aria-label={t("当前筛选条件")}>
    <span className="filter-chips-label">{t("当前条件")}</span>
    {chips.map((chip) => <span key={chip.key + (chip.value ?? "")} className={"filter-chip" + (chip.tone === "plain" ? " filter-chip-plain" : "")}>
      <span className="filter-chip-text">{chip.label}</span>
      <button type="button" onClick={() => onRemove(chip.key, chip.value)} aria-label={t("移除筛选：{name}", { name: chip.label })} title={t("移除筛选：{name}", { name: chip.label })}>
        <X size={11} aria-hidden="true" />
      </button>
    </span>)}
    <button type="button" className="filter-chips-reset" onClick={onReset}>{t("全部清除")}</button>
  </div>;
}
