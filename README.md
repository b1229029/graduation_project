# 「咪挺」– 你的會議紀錄助手

![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![WebSocket](https://img.shields.io/badge/Realtime-WebSocket-orange)
![MySQL](https://img.shields.io/badge/Database-MySQL-blue)

本專案是一套 AI 智慧會議助理系統，可用於會議錄音、即時逐字稿、AI 摘要、心智圖產生、圖片內容分析，以及針對已儲存會議內容進行問答查詢。

## 專案概述

本系統結合瀏覽器前端與 Python 後端。使用者可以建立帳號、建立資料夾、建立會議紀錄，並透過麥克風即時錄音或上傳音訊檔案，由後端進行語音辨識與 AI 整理。會議結束後，系統會保存逐字稿、摘要、圖片分析結果、心智圖與音訊檔案，方便後續查閱與追蹤。

系統主要包含四個工作流程：

- **使用者與會議管理**：註冊、登入、建立資料夾，並管理不同會議紀錄。
- **即時語音轉文字**：透過 WebSocket 傳送麥克風音訊片段，並使用 Whisper 進行辨識。
- **AI 會議整理**：產生會議摘要、即時摘要、圖片分析、心智圖與下次會議議程建議。
- **歷史會議檢視與 RAG 問答**：重新開啟已儲存會議，並根據逐字稿、摘要與圖片分析內容進行問答。

## 功能特色

- **帳號系統**：支援使用者註冊與登入，密碼以雜湊方式儲存。
- **資料夾式會議管理**：使用者可在 Dashboard 中建立資料夾並分類會議。
- **麥克風即時錄音**：瀏覽器端錄音後分段傳送到後端進行即時轉錄。
- **音訊檔案上傳**：支援上傳既有音訊或影片檔案進行轉錄與摘要。
- **Whisper 語音辨識**：使用本機 Whisper 模型處理中文語音轉文字。
- **繁體中文轉換**：透過 OpenCC 將辨識文字轉為繁體中文。
- **議程追蹤**：使用句向量模型比對逐字稿與預先設定的議程主題。
- **討論狀態標記**：以關鍵字規則初步判斷共識或爭議片段。
- **AI 摘要生成**：透過 LLM API 產生結構化摘要與心智圖 Markdown。
- **圖片分析**：可上傳會議截圖、白板或投影片，並將分析結果納入會議紀錄。
- **互動式心智圖**：使用 Markmap 將 AI 產生的 Markdown 渲染成心智圖。
- **心智圖音訊定位**：點擊含時間戳的心智圖節點，可跳轉播放對應音訊片段。
- **會議 RAG 問答**：針對已儲存會議內容提出問題，由系統根據會議資料回答。
- **Google Calendar 整合**：可依據 AI 建議的下次議程建立 Google Calendar 事件。

## 安裝方式

以下步驟以 **Windows PowerShell** 為例。第一次使用時，請依序完成「確認系統工具 → 建立虛擬環境 → 安裝套件 → 建立資料庫 → 視需要建立金鑰檔案」。

### 功能與必要條件

不同功能需要的服務不同，不必為了查看畫面就先設定所有外部服務：

| 想使用的功能 | 必須啟動或設定的項目 |
|---|---|
| 只查看前端畫面 | 靜態網頁伺服器（port `5500`） |
| 註冊、登入、資料夾與會議管理 | 靜態網頁伺服器、FastAPI（port `8000`）、MySQL |
| 即時錄音或上傳音訊轉錄 | 上述項目、WebSocket Listener（port `8765`）、FFmpeg、Whisper 與句向量模型 |
| AI 摘要、心智圖與會議問答 | 上述項目、`.env` 中的 `AI_SERVICE_API_KEY` 與 `BASE_URL` |
| 圖片分析 | FastAPI、`.env` 中的 `VISION_API_KEY`，以及程式指定模型可用的 API |
| 建立 Google Calendar 事件 | `credentials.json`，並完成首次 Google OAuth 授權 |

### 系統需求

- Python 3.10 或以上版本（建議使用 Python 3.10 或 3.11）
- MySQL，或已啟用 MySQL 的 XAMPP
- Chrome、Edge 或其他現代瀏覽器
- FFmpeg 已加入系統環境變數，或在 Windows 中將 `ffmpeg.exe` / `ffprobe.exe` 放在專案旁
- 可連線至模型下載網站的網路環境；首次啟動需要下載 Whisper 與句向量模型
- 數 GB 的可用磁碟空間，用於存放 AI 模型與會議音訊
- 選用：Google Calendar OAuth 憑證，用於建立行事曆事件
- 選用：支援 CUDA 的 GPU，可加速 Whisper 推論

先在 PowerShell 檢查 Python 與 FFmpeg：

```powershell
python --version
ffmpeg -version
ffprobe -version
```

建議顯示 Python `3.10.x` 或 `3.11.x`。如果 `ffmpeg` 或 `ffprobe` 顯示找不到指令，請先安裝 FFmpeg 並加入 PATH，或將兩個執行檔放在專案根目錄。只查看登入頁時可暫時不安裝 FFmpeg。

### 建立 Python 虛擬環境

```powershell
cd <專案目錄>
python -m venv venv
.\venv\Scripts\activate
```

成功啟用後，PowerShell 提示字元前方通常會出現 `(venv)`。之後每次開啟新的終端機，都必須先回到專案目錄並重新執行：

```powershell
.\venv\Scripts\activate
```

目前專案尚未提供鎖定版本的 `requirements.txt`，請先手動安裝主要套件：

```powershell
pip install fastapi uvicorn python-multipart mysql-connector-python passlib python-dotenv
pip install requests websockets pydub numpy torch openai-whisper opencc-python-reimplemented
pip install sentence-transformers google-auth google-auth-oauthlib google-api-python-client openai
```

安裝完成後可先檢查主要套件是否能匯入：

```powershell
python -c "import fastapi, mysql.connector, websockets, whisper, torch; print('Python 套件載入成功')"
```

如果這行出現 `ModuleNotFoundError`，請確認目前終端機已啟用 `venv`，再重新安裝錯誤訊息指出的套件。

建議後續依實際測試環境建立並提交鎖定版本的 `requirements.txt`，避免套件更新後產生相容性問題。

## 系統設定

### 資料庫設定

1. 啟動 MySQL。若使用 XAMPP，只需要在 XAMPP Control Panel 啟動 **MySQL**；本專案不需要 Apache 或 PHP 才能執行。
2. 使用 MySQL 命令列或 phpMyAdmin 建立資料庫。XAMPP 使用者可開啟 <http://localhost/phpmyadmin>，切到「SQL」頁籤後執行：

```sql
CREATE DATABASE whisper_meetings CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

也可以使用命令列：

```powershell
mysql -u root -p
```

輸入密碼後執行上方的 `CREATE DATABASE`。若 XAMPP 的 `root` 沒有密碼，提示輸入密碼時直接按 Enter。

3. 確認 `database.py` 的帳號設定與實際 MySQL 相同。專案預設值為：

```python
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "whisper_meetings"
}
```

如果你的 MySQL 帳號、密碼、主機或資料庫名稱不同，請修改 `database.py` 中的設定。FastAPI 第一次成功連線時會自動建立 `users`、`folders`、`meetings` 資料表，不需要手動建立這三張表。

> FastAPI 即使連不上 MySQL，也可能仍顯示已啟動；此時註冊、登入等資料庫功能仍會失敗。請以終端機是否顯示「資料庫與表格初始化成功」作為判斷依據。

### 環境變數

只有要使用 AI 摘要、心智圖、會議問答或圖片分析時，才需要 `.env`。請在專案根目錄（與 `main.py` 同一層）建立名為 `.env` 的純文字檔；不要命名成 `.env.txt`。

PowerShell 可先建立檔案：

```powershell
New-Item -ItemType File .env
notepad .env
```

填入：

```env
AI_SERVICE_API_KEY=your_chat_api_key
VISION_API_KEY=your_vision_api_key
BASE_URL=https://your-openai-compatible-api-base-url/v1
```

目前程式預設使用以下模型與 API：

- 文字摘要及 RAG 問答：`gpt-oss:20b`，透過 `{BASE_URL}/chat/completions` 呼叫。
- 圖片辨識：`gpt-5.4-mini`，透過 OpenAI Responses API 呼叫。

提供 `BASE_URL` 的 AI 服務必須同時支援上述模型與 API 格式。若服務使用不同模型名稱，請修改：

- `services/ai_service.py` 中的 `CHAT_MODEL`。
- `routers/vision.py` 中的 `MODEL`。

`BASE_URL` 請填 API 根網址且不要以 `/` 結尾，否則文字 API 網址可能出現重複的斜線。`AI_SERVICE_API_KEY` 用於摘要、心智圖和 RAG 問答，`VISION_API_KEY` 用於 `/vision/analyze` 圖片辨識。

這三個值不是專案自動提供的測試金鑰，必須填入實際可用的 API 服務資料。若只測試註冊、登入或資料夾功能，可不建立 `.env`。

`.gitignore` 已排除 `.env`、`credentials.json`、`token.json`、`uploads/`、`venv/` 與 Python 快取資料夾，避免敏感資料被提交。

### Google Calendar 設定

若要啟用下次會議排程功能：

1. 前往 Google Cloud Console 建立 OAuth Client。
2. 下載憑證並命名為 `credentials.json`。
3. 將 `credentials.json` 放在專案根目錄。
4. 第一次建立行事曆事件時，系統會開啟 OAuth 授權流程並產生 `token.json`。

如果不使用 Google Calendar，可以完全略過 `credentials.json` 與 `token.json`。

### `.gitignore` 中的檔案要如何處理

這些項目被 Git 忽略，是因為它們是本機環境、執行後產物、大型檔案或敏感憑證。從 Git 取得專案後看不到它們是正常現象。

| 項目 | 是否手動建立 | 產生或設定方式 |
|---|---:|---|
| `venv/` | 是 | 執行 `python -m venv venv` |
| `__pycache__/` | 否 | Python 執行程式時自動產生 |
| `uploads/` | 否 | FastAPI 啟動時自動建立；上傳音訊後會存放檔案 |
| `*.exe` | 視情況 | 若未將 FFmpeg 加入 PATH，可自行放入 `ffmpeg.exe` 與 `ffprobe.exe` |
| `.env` | 視功能 | 使用 AI 功能時依上一節手動建立，禁止提交真實金鑰 |
| `credentials.json` | 視功能 | 從 Google Cloud Console 下載；只供 Calendar 功能使用 |
| `token.json` | 否 | 第一次完成 Google OAuth 授權後自動產生 |

請勿為了讓這些檔案出現在 Git 中而移除忽略規則，也不要提交 API Key、OAuth 憑證、使用者音訊或 token。

## 使用方式

本專案需要同時啟動兩個後端服務：FastAPI REST API 伺服器，以及 WebSocket 即時音訊處理伺服器。

若要使用完整功能，總共需要開啟 **三個 PowerShell 終端機**。三個終端機都必須停留在專案根目錄；前兩個還必須啟用同一個 `venv`。不要關閉正在執行服務的終端機。

### 首次啟動注意事項

第一次執行 `python listener.py` 時，系統會自動下載並載入：

- Whisper `medium` 語音辨識模型。
- `BAAI/bge-m3` 句向量模型。

請保持網路連線並預留數 GB 的磁碟空間。模型完成下載及載入前，WebSocket 服務不會開始接受連線。沒有 CUDA GPU 仍可使用，但語音辨識速度可能較慢。

### 1. 啟動 WebSocket Listener

開啟第一個終端機：

```powershell
cd <專案目錄>
.\venv\Scripts\activate
python listener.py
```

此服務會啟動即時音訊伺服器：

```text
ws://127.0.0.1:8765
```

程式內部使用 `0.0.0.0:8765` 監聽所有網路介面；`0.0.0.0` 是伺服器綁定位址，不是瀏覽器應開啟的連線網址。

首次執行可能長時間停在模型下載或載入訊息，這是正常現象。必須等到終端機顯示 WebSocket 已啟動，才算 Listener 準備完成。若目前只要測試帳號與資料夾管理，可先略過 Listener。

### 2. 啟動 FastAPI 後端

開啟第二個終端機：

```powershell
cd <專案目錄>
.\venv\Scripts\activate
uvicorn main:app --reload
```

REST API 預設位址為：

```text
http://127.0.0.1:8000
```

FastAPI 啟動時會自動建立需要的資料表。

啟動成功時，終端機應顯示 Uvicorn 正在 `http://127.0.0.1:8000` 執行，且應看到資料庫初始化成功訊息。若出現 `ModuleNotFoundError`，代表 Python 套件未完整安裝；若出現資料庫連線失敗，請回到「資料庫設定」檢查 MySQL。

FastAPI 啟動後，也可以開啟自動產生的 API 文件：

- Swagger UI：<http://127.0.0.1:8000/docs>
- ReDoc：<http://127.0.0.1:8000/redoc>

### 3. 開啟前端頁面

開啟第三個終端機，在專案根目錄執行：

```powershell
cd <專案目錄>
python -m http.server 5500
```

接著使用瀏覽器開啟：

```text
http://127.0.0.1:5500/login.html
```

`python -m http.server` 只負責提供 HTML、CSS 與 JavaScript，不會自動啟動 FastAPI、MySQL 或 Listener。看到登入畫面不等於後端功能已經可用。

不建議直接雙擊 HTML 檔案，以避免麥克風權限、跨來源請求或前端資源載入問題。心智圖及 Markdown 顯示會從 CDN 載入 D3、Markmap、Marked 和 DOMPurify，因此使用這些畫面時需要網路連線。

建議使用流程：

1. 註冊使用者帳號。
2. 登入後進入 `dashboard.html`。
3. 建立資料夾。
4. 建立會議。
5. 進入 `index.html` 開始錄音或上傳音訊。
6. 查看逐字稿、AI 摘要、圖片分析與心智圖。
7. 從 `view.html` 重新檢視已儲存的會議。

### 啟動後檢查清單

依序確認以下網址或狀態：

1. 開啟 <http://127.0.0.1:8000/docs>，確認 FastAPI 文件能顯示。
2. 開啟 <http://127.0.0.1:5500/login.html>，確認登入頁能顯示。
3. 建立一個測試帳號；成功代表前端、FastAPI 與 MySQL 三者已連通。
4. 登入後建立資料夾與會議；成功代表主要 CRUD API 可用。
5. 進入會議頁，確認 Listener 終端機出現新的 WebSocket 連線，再測試錄音或音訊上傳。
6. 最後測試摘要、圖片分析與 Google Calendar；這些功能各自依賴 API Key 或 OAuth 憑證。

也可用 PowerShell 檢查三個連接埠：

```powershell
Test-NetConnection 127.0.0.1 -Port 5500
Test-NetConnection 127.0.0.1 -Port 8000
Test-NetConnection 127.0.0.1 -Port 8765
```

對應服務啟動後，該指令的 `TcpTestSucceeded` 應為 `True`。

### 關閉專案

在三個執行服務的終端機中分別按 `Ctrl+C`。關閉終端機前先停止服務，可避免連接埠仍被背景程序占用。MySQL 可在 XAMPP Control Panel 或 Windows 服務管理工具中停止。

## API 端點

| Endpoint | Method | 功能 |
|----------|--------|------|
| `/register` | POST | 建立新使用者帳號 |
| `/login` | POST | 使用者登入 |
| `/folders` | POST | 建立資料夾 |
| `/folders/{user_id}` | GET | 取得指定使用者的資料夾 |
| `/folders/{folder_id}` | DELETE | 刪除資料夾與其下會議 |
| `/meetings` | POST | 建立會議 |
| `/meetings/by_folder/{folder_id}` | GET | 取得資料夾中的會議列表 |
| `/meetings/{meeting_id}` | GET | 取得單場會議完整資料 |
| `/meetings/{meeting_id}` | PUT | 儲存逐字稿、摘要、圖片分析與心智圖 |
| `/meetings/{meeting_id}/upload_audio` | POST | 上傳完整會議音訊 |
| `/meetings/{meeting_id}` | DELETE | 刪除單場會議 |
| `/meetings/{meeting_id}/chat` | POST | 針對會議內容進行 RAG 問答 |
| `/vision/analyze` | POST | 分析上傳圖片 |

## WebSocket 訊息流程

前端會連線到 `listener.py` 所提供的 WebSocket 服務，並傳送 JSON 控制訊息與二進位音訊資料。

| Message Type | 方向 | 功能 |
|--------------|------|------|
| `setup_agenda` | 前端到後端 | 初始化議程與與會者資料 |
| `agenda_ready` | 後端到前端 | 確認議程設定完成 |
| 二進位音訊片段 | 前端到後端 | 傳送麥克風音訊供即時轉錄 |
| `transcript` | 後端到前端 | 回傳辨識文字與命中的議程 |
| `request_interim_summary` | 前端到後端 | 要求最近逐字稿的即時摘要 |
| `interim_summary_result` | 後端到前端 | 回傳即時摘要 |
| `analyze_image` | 前端到後端 | 傳送 base64 圖片進行分析 |
| `image_analysis_result` | 後端到前端 | 回傳圖片分析文字 |
| `append_image_result` | 前端到後端 | 將 REST API 完成的圖片分析結果加入會議逐字稿 |
| `start_file_upload` | 前端到後端 | 通知後端開始接收完整音訊檔案 |
| `end_file_upload` | 前端到後端 | 通知後端音訊傳送完成並開始轉錄 |
| `upload_progress` | 後端到前端 | 回傳圖片分析、音訊轉錄或摘要產生進度 |
| `request_summary` | 前端到後端 | 要求產生最終摘要與心智圖 |
| `summary_result` | 後端到前端 | 回傳 AI 總結結果 |
| `schedule_next` | 前端到後端 | 建立 Google Calendar 事件 |
| `schedule_success` | 後端到前端 | 回傳建立完成的 Google Calendar 事件連結 |
| `error` | 後端到前端 | 回傳 AI、圖片、音訊或行事曆處理錯誤 |

## 實作說明

- `main.py`：建立 FastAPI app、掛載上傳檔案路徑、設定 CORS 並註冊 routers。
- `database.py`：處理 MySQL 連線、建立 `users`、`folders`、`meetings` 資料表，並補齊圖片分析欄位。
- `listener.py`：負責 WebSocket 即時流程，串接語音辨識、AI 摘要、圖片分析與行事曆服務。
- `services/audio_service.py`：載入 Whisper、OpenCC 與句向量模型，並提供議程追蹤與討論狀態判斷。
- `services/ai_service.py`：集中管理 AI 摘要、即時摘要與圖片分析 API 呼叫。
- `services/rag_service.py`：將長篇會議內容分段並以 cosine similarity 找出最相關片段進行問答。
- `record.js`：控制會議錄製頁面，負責錄音流程、WebSocket 訊息、圖片上傳、摘要請求與資料儲存。
- `ui_manager.js`：管理前端 DOM 狀態、逐字稿渲染、議程標記、摘要顯示與心智圖互動。
- `audio_manager.js`：封裝瀏覽器 MediaRecorder API，保留即時音訊片段與完整會議音訊。

## 專案結構

```text
graduation_project/
├── main.py                         # FastAPI 後端入口
├── listener.py                     # WebSocket 即時音訊與 AI 流程伺服器
├── database.py                     # MySQL 連線與資料表建立
├── schemas.py                      # Pydantic 請求資料模型
├── login.html                      # 登入與註冊頁
├── dashboard.html                  # 資料夾與會議管理頁
├── index.html                      # 即時會議錄製頁
├── view.html                       # 歷史會議檢視頁
├── audio_manager.js                # 瀏覽器錄音工具
├── record.js                       # 會議頁主控制器與後端串接
├── ui_manager.js                   # 前端 UI 狀態與畫面渲染管理
├── routers/
│   ├── auth.py                     # 註冊與登入 API
│   ├── folders.py                  # 資料夾 CRUD API
│   ├── meetings.py                 # 會議 CRUD、音訊上傳與 RAG 問答 API
│   └── vision.py                   # 圖片分析 API
├── services/
│   ├── ai_service.py               # AI 摘要與圖片分析服務
│   ├── audio_service.py            # Whisper、OpenCC、議程追蹤與討論標記
│   ├── calendar_service.py         # Google Calendar 事件建立
│   └── rag_service.py              # 會議內容檢索增強問答
├── docs/
│   ├── 需求規格書.pdf
│   ├── 設計文件書.pdf
│   ├── 4.20專題報告ppt.pdf
│   ├── 6.3專題報告ppt.pdf
│   └── 大三下第二次簡報影片.mov
├── uploads/                        # 產生的會議音訊檔，已被 Git 忽略
├── .env                            # 本機 API 金鑰，已被 Git 忽略
├── credentials.json                # Google OAuth 憑證，已被 Git 忽略
├── token.json                      # Google OAuth token，已被 Git 忽略
└── README.md
```

## 資料模型

| 資料表 | 說明 |
|--------|------|
| `users` | 儲存使用者帳號、Email、密碼雜湊與重設 token 欄位 |
| `folders` | 儲存使用者建立的會議資料夾 |
| `meetings` | 儲存會議標題、逐字稿、圖片分析、摘要、心智圖、音訊路徑與建立時間 |

`folders` 會關聯到 `users`，`meetings` 會關聯到 `folders`。兩者皆使用 cascade delete，因此刪除上層資料時，下層資料會一併刪除。

## 常見問題

- **無法連線 MySQL**：確認 MySQL 已啟動，並檢查 `database.py` 中的 `DB_CONFIG` 是否正確。
- **麥克風無法使用**：請使用 Chrome 或 Edge，並允許瀏覽器使用麥克風。
- **沒有逐字稿輸出**：確認 `listener.py` 已啟動，且 FFmpeg 可被系統找到。
- **AI 摘要失敗**：確認 `.env` 中的 `BASE_URL` 與 API Key 是否正確。
- **Google Calendar 排程失敗**：確認 `credentials.json` 存在，且 Google Calendar API 已啟用。
- **第一次啟動很慢**：`listener.py` 會載入 Whisper 與 sentence-transformer 模型，首次啟動需要較長時間。

## 目前限制與安全提醒

本專案目前以本機開發及專題展示為主，尚未實作完整的正式部署安全機制：

- 登入功能尚未使用 JWT 或伺服器端 Session；後端不會驗證每個請求是否來自已登入使用者。
- API 尚未確認資料夾與會議是否屬於目前使用者；知道資源 ID 的人可能直接查詢、修改或刪除資料。
- FastAPI CORS 目前允許所有來源呼叫。
- 音訊、圖片及 WebSocket 上傳尚未設定檔案大小限制。
- API 金鑰、`credentials.json` 和 `token.json` 都只能保存在本機，不可提交到 Git 或公開分享。

在加入身分驗證、資源存取控制、限制 CORS 來源及上傳大小前，請勿直接部署至公開網路。

## 授權

目前此專案尚未包含授權檔案。
