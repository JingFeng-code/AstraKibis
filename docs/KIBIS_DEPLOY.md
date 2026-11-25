# AstraKibis 部署、更新與回滾手冊

## Nodaroo 首次切換
1. 停止服務，下載 data/、.env、.env.local（若存在）、launcher.js；記錄目前 Git SHA。SQLite 停機備份需保留 WAL/SHM 等相關檔案。
2. 保持原本的 launcher.js，暫時開啟平台 Auto Update，啟動一次取得已驗收的 main；停止服務，再關閉 Auto Update。
3. 將既有未追蹤的 launcher.js 內容替換為 scripts/kibis-nodaroo-wrapper.js.txt。不要重新安裝容器。Startup 的 Main file 為 launcher.js、Node args 留空，Node 版本建議 24 LTS（既有 25 可先保留）。
4. .env 保留現值，確認 KIBIS_SOURCE_PROFILE=taiwan、APP_REPO=JingFeng-code/AstraKibis、HOST=0.0.0.0、PORT=實際分配連接埠、TZ=Asia/Taipei。
5. 啟動。首次使用版本戳記會重新建置；其後相同 Git SHA、lockfile、package.json 與有效 index.html 時跳過。
6. 核對 /health、繁中介面、來源、收藏與日誌；不要在 HTTP 公開站輸入管理密碼或金鑰。

## 日常更新
維持平台 Auto Update OFF。在停止服務後，暫時把 Startup 的 Node args 設為 --update，再啟動。
啟動器只接受 AstraKibis origin 與 main，拒絕有追蹤檔案變更的工作目錄；fetch 後若有新版本，先以 SQLite VACUUM INTO 建立一致性備份並備份設定，再 fast-forward 合併、建置、啟動。成功後清除 Node args。若已在最新版不重複備份。
--backup 可在啟動前額外建立備份。備份包含私密設定，不得公開或上傳 GitHub；定期下載異地保留，檢查主機空間後人工清理舊備份。Node/npm 套件依然使用平台既有模式；並非完全可重現的 pnpm 部署。
若建置失敗，保留上一個前端副本但不啟動不相容的服務；不要反覆重啟。

## 從 Nodaroo 回滾程式（僅限資料庫相容版本）
先確認資料庫 schema 與目標版本相容，並下載停機備份。在 Startup 的 Node args 輸入 --rollback-code=<備份資料夾名稱>（只填名稱，不含路徑），再啟動。啟動器核對備份 manifest、Git SHA、歷史關係及目標版本有無啟動器，備份目前資料後切至 detached HEAD、重建前端；不還原資料庫。成功後清空 Node args。回到 main 可使用 --return-main 一次，再清空參數。
這不是跨 schema 的自動回滾；如果要復原舊資料庫、舊版沒有啟動器或未通過相容性檢查，使用下面人工程序。不要把 --rollback-code 當作修復資料庫的指令。

## 手動回滾（需 Shell 或管理員操作）
先停止所有寫入，下載目前資料及備份。從 .kibis-backups/<日期-SHA>/manifest.json 確認上一版 SHA 和資料庫路徑。
在有 Shell 的環境確認 git status、備份完整性後，用 git switch --detach <已驗收的SHA> 切回舊程式；必要時還原對應資料庫（保留目前 DB/WAL/SHM 到另一個備份，確認無程序使用後才替換），還原對應環境設定，依版本重新建置，再啟動。不要在有資料的情況下直接 reset --hard、刪除 data 或 Reinstall。
Nodaroo 的應用程式 Console 不是 Shell；若無 Shell，透過檔案管理器還原停機備份或請平台管理員協助。回滾到沒有新啟動器的版本時，須同時還原原 launcher.js。資料庫回滾可能失去備份之後的新資料，需人工確認；不自動還原或刪除資料庫。
回到 main 前，先核對版本與資料庫相容性，再 git switch main。確認 Auto Update 仍為 OFF。

## 安全與限制
不增加主機、付費 AI 或其他服務。GitHub CI 驗證建置及基本版本判斷；尚未對 Nodaroo 執行完整故障注入與回滾演練。免費主機長期可用性不保證。npm 安全警告需另外審查。
