/** Rule hints, not verified provider terms. No network, AI or paid service. */
export const FREE_TYPES = ["long_term", "recurring", "limited_claim", "trial", "one_time", "conditional", "paid", "unknown"] as const;
export const REGIONS = ["taiwan_mentioned", "restricted_elsewhere", "unknown"] as const;
export const CARD_REQUIREMENTS = ["required", "not_required_claim", "unknown"] as const;
export const BILLING_RISKS = ["possible_charge", "no_charge_claim", "unknown"] as const;
export type FreeType = typeof FREE_TYPES[number];
export type RegionHint = typeof REGIONS[number];
export type ResourceQuality = {
  freeType: FreeType;
  region: RegionHint;
  card: typeof CARD_REQUIREMENTS[number];
  billing: typeof BILLING_RISKS[number];
  evidenceStatus: "text_hint" | "unknown";
  evidence: string[];
  verifiedAt: null;
};
const TRIAL = /免費試用|免费试用|試用期|试用期|首月免費|首月免费|\bfree trial\b|\btrial period\b/i;
const RECURRING = /(?:每月|每日|每天|每週|每周).{0,24}(?:免費|免费|額度|额度|贈送|赠送|tokens?|credits?)|(?:免費|免费|額度|额度|credits?).{0,24}(?:每月|每日|每天|每週|每周)|\b(?:monthly|daily|weekly) free (?:credits?|quota|tokens?|allowance)\b|\bfree (?:credits?|quota|tokens?|allowance) (?:per|every) (?:day|month|week)\b/i;
const ONE_TIME = /一次性.{0,16}(?:額度|额度|贈|赠|免費|免费)|新戶.{0,12}(?:贈|送)|新用户.{0,12}(?:赠|送)|\bone[- ]time (?:free )?(?:credits?|bonus)\b|\b(?:sign[- ]up|new customer) (?:bonus|credits?)\b/i;
const LIMITED = /限時免費|限时免费|限免|限時領取|限时领取|免費領取至|免费领取至|\bfree to keep\b|\b100\s*%\s*off\b|\bfree until\b/i;
const CONDITIONAL = /(?:僅限|仅限|專屬|专属|限定).{0,16}(?:學生|学生|教師|教师|新戶|新用户|會員|会员)|\b(?:students?|educators?|new customers?) only\b|\b(?:student|education) (?:plan|discount|offer)\b/i;
const LONG_TERM = /永久免費|永久免费|長期免費|长期免费|永遠免費|永远免费|\balways free\b|\bfree forever\b|\bforever free\b/i;
const PAID = /付費方案|付费方案|需付費|需付费|\bpaid plan\b|\bpaid subscription\b|\b(?:sale|discount)\b|折扣|特價|特价/i;
const REVOKED = /不再.{0,12}(?:免費|免费)|(?:免費|免费).{0,8}(?:已取消|已結束|已结束|已到期)|\bfree (?:tier|plan|credits?) (?:has been |was )?(?:removed|discontinued|ended)\b/i;
const QUESTION = /[?？]|是否|有沒有|有没有|請問|请问|\bis it free\b/i;
const TW = /(?:台灣|臺灣|台湾).{0,12}(?:可用|適用|适用|可申請|可申请|開放|开放)|\b(?:available|eligible) in Taiwan\b/i;
const RESTRICTED = /(?:僅限|仅限|限於|限于).{0,14}(?:中國大陸|中国大陆|中國內地|中国内地|美國|美国|加拿大|英國|英国)|\b(?:US|U\.S\.|USA|UK|Canada|China) (?:residents?|customers?|users?) only\b|\b(?:US|USA|UK|Canada|China)[- ]only\b|\bonly available in (?:the )?(?:US|USA|UK|Canada|China)\b/i;
const TW_EXCLUDED = /(?:不支援|不支持|不適用|不适用|不開放|不开放).{0,10}(?:台灣|臺灣|台湾)|(?:台灣|臺灣|台湾).{0,10}(?:不可用|不適用|不适用|不可申請|不可申请)|\bnot (?:available|eligible) in Taiwan\b/i;
const CARD_NO = /免綁卡|免绑卡|無需信用卡|无需信用卡|不需信用卡|\bno credit card required\b|\bwithout (?:a )?credit card\b/i;
const CARD_YES = /需要信用卡|需綁卡|需绑卡|必須綁卡|必须绑卡|\bcredit card required\b|\brequires (?:a )?credit card\b/i;
const BILLING_YES = /超額.{0,12}(?:收費|收费|扣款)|(?:到期|試用|试用).{0,12}(?:自動續訂|自动续订|自動扣款|自动扣款|收費|收费)|\b(?:overage charges?|pay as you go|auto[- ]renew(?:al)?|then billed|then charged|usage[- ]based billing)\b/i;
const BILLING_NO = /超額.{0,12}(?:不收費|不收费|停止服務|停止服务|直接停用)|\bno overage charges?\b|\bhard spending cap\b/i;
function match(text: string, re: RegExp): string | undefined { return text.match(re)?.[0]?.slice(0, 120); }
export function assessResource(title: string, summary: string | null | undefined, kind?: string | null): ResourceQuality {
  // Same bounded input for SQL filtering and API presentation. Do not use AI reasoning as evidence.
  const text = (title + " " + (summary ?? "").slice(0, 1200)).replace(/https?:\/\/\S+/gi, " ");
  const evidence: string[] = [];
  const mark = (re: RegExp) => { const hit = match(text, re); if (hit) evidence.push(hit); return Boolean(hit); };
  let freeType: FreeType = "unknown";
  const uncertain = REVOKED.test(text) || QUESTION.test(title);
  const editorial = kind === "news" || kind === "noise";
  if (!uncertain && !editorial) {
    // Conservative precedence: trial/limited/conditional claims never become long-term free.
    if (mark(TRIAL)) freeType = "trial";
    else if (mark(ONE_TIME)) freeType = "one_time";
    else if (mark(CONDITIONAL)) freeType = "conditional";
    else if (mark(LIMITED)) freeType = "limited_claim";
    else if (mark(RECURRING)) freeType = "recurring";
    else if (mark(LONG_TERM)) freeType = "long_term";
    else if (mark(PAID)) freeType = "paid";
  }
  const region = mark(TW_EXCLUDED) || mark(RESTRICTED) ? "restricted_elsewhere" : !uncertain && mark(TW) ? "taiwan_mentioned" : "unknown";
  const cardNo = mark(CARD_NO);
  const cardYes = mark(CARD_YES);
  const card = cardNo ? (cardYes && !/no credit card required/i.test(text) ? "unknown" : "not_required_claim") : cardYes ? "required" : "unknown";
  const noCharge = mark(BILLING_NO), charges = mark(BILLING_YES);
  // An explicit risk signal wins; a claimed spending cap is not a zero-cost guarantee.
  const billing = charges && !noCharge ? "possible_charge" : noCharge && !charges ? "no_charge_claim" : charges && noCharge ? "possible_charge" : "unknown";
  return { freeType, region, card, billing, evidenceStatus: evidence.length ? "text_hint" : "unknown", evidence: [...new Set(evidence)], verifiedAt: null };
}
export const CATALOG_SOURCE_IDS = ["github-free-for-dev", "github-public-apis", "github-awesome-ai", "github-selfhosted"] as const;
export const isCatalogSource = (id: string): boolean => (CATALOG_SOURCE_IDS as readonly string[]).includes(id);
