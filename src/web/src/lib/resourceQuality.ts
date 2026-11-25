import { t } from "./i18n.ts";
export const qualityLabels: Record<string, Record<string, string>> = {
  "freeType": {
    "long_term": "長期免費（文字線索）",
    "recurring": "定期免費額度",
    "limited_claim": "限時領取",
    "trial": "免費試用",
    "one_time": "一次性贈額",
    "conditional": "條件式免費",
    "paid": "付費優惠",
    "unknown": "免費類型未確認"
  },
  "regionHint": {
    "taiwan_mentioned": "文中提及台灣可用",
    "restricted_elsewhere": "其他地區限定／台灣不適用",
    "unknown": "地區未確認"
  },
  "billingRisk": {
    "possible_charge": "可能收費",
    "no_charge_claim": "文中宣稱超額不收費",
    "unknown": "收費風險未確認"
  },
  "cardRequirement": {
    "required": "需綁卡",
    "not_required_claim": "文中宣稱免綁卡",
    "unknown": "信用卡需求未確認"
  },
  "resourceNature": {
    "catalog": "靜態資源清單",
    "update": "動態資訊"
  }
};
export const qualityFields = [
  ["freeType", "免費類型"], ["regionHint", "地區線索"], ["billingRisk", "收費風險"], ["cardRequirement", "信用卡需求"], ["resourceNature", "資訊類型"],
] as const;
export const qualityLabel = (field: string, value: string): string => t(qualityLabels[field]?.[value] ?? value);
