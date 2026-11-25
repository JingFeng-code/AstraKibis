<div align="center">
<img src="docs/logo.svg" alt="AstraKibis" width="96" height="96" />
<h1>AstraKibis</h1>
<p><strong>每天收集小寶藏。</strong></p>
<p>Little treasures, gathered daily.</p>
<a href="https://github.com/JingFeng-code/AstraKibis/actions/workflows/ci.yml"><img src="https://github.com/JingFeng-code/AstraKibis/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-365875" alt="MIT" /></a>
</div>

AstraKibis 是輕量、自架式資源探索工具，聚合台灣與全球的免費資源、AI 工具、雲端服務、開源專案及科技資訊，讓有價值的小發現不再錯過。以台灣繁體中文為預設，不需 AI API 即可使用。

## 核心功能

- 台灣優先的來源設定：免費資源網、iThome、科技新報、OpenRouter、GitHub、Cloudflare、OpenAI 等；保留國際數位資源及遊戲限免。
- 搜尋、分類、篩選、收藏、已讀、列表／卡片檢視，以及 RSS、選用的 Telegram 推播。
- 保留規則分類、跨來源去重及選用 AI 審核；已審核頻道與一般收錄分開，未經核實不等同免費保證。
- SQLite 本機資料庫；React 19、Vite、Hono、TypeScript；支援淺色及深色介面。
- 內建來源停用而非刪除，保留既有歷史資料與收藏。來源可能有地域限制、試用、信用卡或超額收費；請以官方條款為準。價格尚未全面改為新台幣。

## 快速開始（原始碼）

需 Node.js 22.5 以上（建議 24 LTS）及 pnpm 10：

```bash
git clone https://github.com/JingFeng-code/AstraKibis.git
cd AstraKibis
cp .env.example .env
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

預設本機網址 http://127.0.0.1:8788。依需求調整 `.env`。部署公開站請先設定 HTTPS 及管理存取限制；勿將 Token、Cookie 或 API 金鑰寫入儲存庫。

| 變數 | 說明 |
|---|---|
| KIBIS_SOURCE_PROFILE=taiwan | 套用台灣優先資料來源設定 |
| TZ=Asia/Taipei | 台灣時間 |
| SITE_MODE=selfhost | 個人自架模式 |
| DATABASE_PATH=./data/radar.db | 持久化 SQLite 資料庫 |
| ENABLE_SCHEDULER=true | 定時採集 |
| ADMIN_TOKEN | 管理密碼；正式環境未設定時鎖定管理區 |
| AI_BASE_URL / AI_MODEL / AI_API_KEY | 選用；不填仍可瀏覽 |
| APP_REPO=JingFeng-code/AstraKibis | 版本查詢來源 |

## Nodaroo / 更新及備份

請參考 [部署及回滾手冊](docs/KIBIS_DEPLOY.md)。只使用已驗收的 main 版本，備份 SQLite 與環境設定，前端需與原始碼一起更新。不要直接使用上游 Docker image 取代本專案；目前未發布 AstraKibis 自有容器映像。主機及 API 的免費資格需自行核對。

## 開發與驗收

```bash
pnpm typecheck
pnpm test
pnpm build
```

- [台灣日常使用版](docs/TAIWAN_BASELINE.md)
- [品牌規範](docs/KIBIS_BRAND.md)
- [上游原始專案及完整功能說明](https://github.com/ZiChuanLan/freebie-radar)

## 授權與來源

本專案衍生自 [ZiChuanLan/freebie-radar](https://github.com/ZiChuanLan/freebie-radar)，保留原 MIT 授權與著作權聲明（[LICENSE](LICENSE)）。繁中離線字典部分衍生自 OpenCC 1.1.9，依 [Apache-2.0](licenses/OpenCC-LICENSE.txt) 授權。資料來源與原始文章的權利屬於各自作者；本站僅提供索引與摘要，不保證內容或優惠有效。其他上游語言 README、舊截圖與技術文件屬歷史參考，未必反映 AstraKibis 現況。

## 資源品質（v0.3 第一階段）
規則式免費類型、地區／信用卡／收費風險線索及靜態清單篩選；文字線索不等同官方查證。見 [品質模型與驗收](docs/KIBIS_RESOURCE_QUALITY.md)。
