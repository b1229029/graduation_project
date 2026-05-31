# 「咪挺」– 你的會議紀錄助手

![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-blue)
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

### 系統需求

- Python 3.8 或以上版本
- MySQL，或已啟用 MySQL 的 XAMPP
- Chrome、Edge 或其他現代瀏覽器
- FFmpeg 已加入系統環境變數，或在 Windows 中將 `ffmpeg.exe` / `ffprobe.exe` 放在專案旁
- 選用：Google Calendar OAuth 憑證，用於建立行事曆事件
- 選用：支援 CUDA 的 GPU，可加速 Whisper 推論

### 建立 Python 虛擬環境

```powershell
cd C:\Users\user\Downloads\graduation_project-main\graduation_project-main
python -m venv venv
.\venv\Scripts\activate
```

如果專案後續加入 `requirements.txt`，可使用以下指令安裝：

```powershell
pip install -r requirements.txt
```

若目前沒有 `requirements.txt`，可手動安裝主要套件：

```powershell
pip install fastapi uvicorn python-multipart mysql-connector-python passlib python-dotenv
pip install requests websockets pydub numpy torch openai-whisper opencc-python-reimplemented
pip install sentence-transformers google-auth google-auth-oauthlib google-api-python-client openai
```

## 系統設定

### 資料庫設定

請先建立 MySQL 資料庫：

```sql
CREATE DATABASE whisper_meetings CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

預設資料庫連線設定位於 `database.py`：

```python
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "whisper_meetings"
}
```

如果你的 MySQL 帳號、密碼或主機不同，請修改 `database.py` 中的設定。

### 環境變數

如需使用 AI 摘要與圖片分析，請在專案根目錄建立 `.env`：

```env
AI_SERVICE_API_KEY=your_chat_api_key
VISION_API_KEY=your_vision_api_key
BASE_URL=https://your-openai-compatible-api-base-url
```

`.gitignore` 已排除 `.env`、`credentials.json`、`token.json`、`uploads/`、`venv/` 與 Python 快取資料夾，避免敏感資料被提交。

### Google Calendar 設定

若要啟用下次會議排程功能：

1. 前往 Google Cloud Console 建立 OAuth Client。
2. 下載憑證並命名為 `credentials.json`。
3. 將 `credentials.json` 放在專案根目錄。
4. 第一次建立行事曆事件時，系統會開啟 OAuth 授權流程並產生 `token.json`。

## 使用方式

本專案需要同時啟動兩個後端服務：FastAPI REST API 伺服器，以及 WebSocket 即時音訊處理伺服器。

### 1. 啟動 WebSocket Listener

開啟第一個終端機：

```powershell
cd C:\Users\user\Downloads\graduation_project-main\graduation_project-main
.\venv\Scripts\activate
python listener.py
```

此服務會啟動即時音訊伺服器：

```text
ws://0.0.0.0:8765
```

### 2. 啟動 FastAPI 後端

開啟第二個終端機：

```powershell
cd C:\Users\user\Downloads\graduation_project-main\graduation_project-main
.\venv\Scripts\activate
uvicorn main:app --reload
```

REST API 預設位址為：

```text
http://127.0.0.1:8000
```

FastAPI 啟動時會自動建立需要的資料表。

### 3. 開啟前端頁面

可直接用瀏覽器開啟 `login.html`，或將專案放到 Apache / XAMPP 的網站目錄後，以本機網址開啟。

建議使用流程：

1. 註冊使用者帳號。
2. 登入後進入 `dashboard.html`。
3. 建立資料夾。
4. 建立會議。
5. 進入 `index.html` 開始錄音或上傳音訊。
6. 查看逐字稿、AI 摘要、圖片分析與心智圖。
7. 從 `view.html` 重新檢視已儲存的會議。

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
| `request_summary` | 前端到後端 | 要求產生最終摘要與心智圖 |
| `summary_result` | 後端到前端 | 回傳 AI 總結結果 |
| `schedule_next` | 前端到後端 | 建立 Google Calendar 事件 |

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
graduation_project-main/
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
│   └── 4.20專題報告ppt.pdf
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

## 文件

其他專題文件位於 `docs/` 目錄：

- `需求規格書.pdf`
- `設計文件書.pdf`
- `4.20專題報告ppt.pdf`

## 授權

目前此專案尚未包含授權檔案。若未來要公開或開源，建議新增 `LICENSE` 檔案並明確標示授權方式。