# AstraKibis 台灣日常使用版（第一階段）

基準：Freebie Radar 1.1.14。保留原 MIT LICENSE、React/Hono/SQLite、UI 布局及採集器；不新增付費服務或 npm 相依套件。

- 繁體中文為預設介面；保留既有 zh 語系偏好鍵與 English 選項，支援 lang=zh-TW，日期與 HTML lang 採 zh-TW。詞彙採離線字典及台灣用語覆寫。原始新聞標題、摘要、第三方資料、未經 t() 的動態錯誤仍可能為原文；完整人工文案驗收尚未完成。
- 預設首頁為所有收錄，不把未經 AI 審核的內容當成已驗證免費資源；嚴格審核頻道保留。
- 台灣來源設定需在既有部署的 .env 明確加入 KIBIS_SOURCE_PROFILE=taiwan；無此設定維持上游資料源行為。第一次啟動調整內建資料源的 enabled 欄位，保留歷史項目、收藏及自訂來源；此後可在管理區自行調整。普通瀏覽隱藏已停用的非優先舊來源；明確選來源或查看收藏仍可查看。歷史摘要及熱門資料尚未確認全面排除。
- 台灣設定啟用 34 個候選來源，含免費資源網、OpenRouter、GitHub 清單、國際遊戲及官方技術資訊。新增 iThome、科技新報、Microsoft .NET、GitHub Blog RSS；第一版四個來源已於 Nodaroo 成功採集；第二版新增重灌狂人、GitHub Changelog，仍需正式機採集驗證。遵守來源使用條款。
- 停用 88 個非優先內建來源，含中國地區新聞、需登入 Cookie 的社群、地區限定實體試用品等；不表示這些來源的所有內容均不適用。
- 台灣申請資格、免費政策、超額扣款與幣別尚未重設，禁止將未查證資訊當成零費用保證。原價格以人民幣正規化，不得直接當新台幣。

## 第一版 Nodaroo 發布紀錄
備份 .env、launcher.js、data/（停機備份 SQLite），記錄現有 SHA。新版部署請以 [部署與回滾手冊](KIBIS_DEPLOY.md) 為準，不直接部署 Draft。更新後 .env 加 KIBIS_SOURCE_PROFILE=taiwan、APP_REPO=JingFeng-code/AstraKibis，必須重新建置 dist/web（現有 launcher 只在缺少 index.html 時建置），不能只 git pull。檢查 /health、首頁、資料庫、來源啟停、收藏、排程和採集；回滾時還原程式版本及備份資料庫/設定。不啟用付費 AI、FlareSolverr 或新主機。HTTP 管理憑證及已報告的 npm 漏洞仍需安全審查。

## 字典來源
衍生自 OpenCC ver.1.1.9（https://github.com/BYVoid/OpenCC/tree/ver.1.1.9/data/dictionary），使用 STCharacters、STPhrases 的部分詞彙、TWPhrasesIT、TWPhrasesOther、TWVariants，加入本專案台灣用語覆寫。字典衍生檔依 Apache-2.0，授權見 licenses/OpenCC-LICENSE.txt；本專案原 MIT 授權不變。這是簡化的最長匹配轉換，不是完整 OpenCC 演算法。
