# myNotion 交接文件 (Handover Document)

這是一份關於 `myNotion` 專案的詳細交接文件。本專案是一個受 Notion 啟發的「階層式區塊編輯器 (Hierarchical Block-based Editor)」，支援 Markdown 與靈活的內容排序。

## 1. 專案概述 (Project Overview)
`myNotion` 旨在提供一個簡潔、高效的筆記環境，核心功能在於其**階層式區塊管理**。使用者可以透過縮排與拖放，自由組織筆記內容的邏輯架構。

## 2. 系統架構 (Architecture)

### 前端 (Frontend)
- **核心框架**: Vue 3 (Composition API)
- **建置工具**: Vite
- **狀態管理**: Pinia
- **主要組件**:
  - `Editor.vue`: 編輯器主入口，處理全域區塊狀態。
  - `EditorBlockNode.vue`: 遞迴式區塊組件，負責處理單個區塊的渲染、輸入、縮排邏輯及其子區塊。
  - `Sidebar.vue`: 文件導覽與清單管理。

### 後端 (Backend)
- **核心框架**: Spring Boot 3.2.3
- **語言**: Java 21
- **資料庫**: H2 (記憶體/本地磁碟，開發階段使用)
- **持久層**: Spring Data JPA
- **API 通訊**: 提供 RESTful API 供前端進行 CRUD 操作。

## 3. 核心功能技術棧 (Key Features Tech Stack)

- **拖拽排序 (Drag & Drop)**: 使用 `vuedraggable (Sortable.js)` 實作。支援連同子區塊一起進行整體拖動，保持階層結構。
- **Markdown 渲染**: 整合 `marked` 套件進行即時轉換。
- **代碼高亮**: 使用 `highlight.js` 處理程式碼區塊。
- **表格支援**: 支援標準 Markdown 表格，具備自定義樣式。
- **安全防護**: 使用 `dompurify` 過濾 Markdown 渲染後的 HTML，防止 XSS 攻擊。
- **網路請求**: 使用 `axios` 處理前端與後端 API 的通訊。

## 4. 啟動與開發指引 (Setup & Running)

### 後端啟動
1. 確保已安裝 JDK 21。
2. 進入 `backend` 目錄。
3. 執行：`./mvnw spring-boot:run`
4. API 預設運行於 `http://localhost:8081`。

### 前端啟動
1. 確保已安裝 Node.js。
2. 進入 `frontend-vue` 目錄。
3. 執行：`npm install` (首次啟動)
4. 執行：`npm run dev`
5. 前端預設啟動於 `http://localhost:5173`。

## 5. 專案目錄結構 (Project Structure)

```text
d:/myNotion
├── backend/                # Spring Boot 後端代碼
│   └── src/main/java       # Java 源碼 (含 Controller, Entity, Repository)
├── frontend-vue/           # Vue 3 前端專案
│   ├── src/components      # 核心組件 (Editor, Sidebar 等)
│   └── src/stores         # Pinia 狀態管理
└── sample1.json            # 範例資料檔 (可供測試匯入)
```

## 6. 未來擴展建議 (Future Enhancements)
1. **即時協作**: 引入 WebRTC 或 WebSocket (如 Y.js) 實作多人共同編輯。
2. **更多區塊類型**: 增加圖片、清單、Callout、同步區塊等功能。
3. **搜尋系統**: 整合 ElasticSearch 或實作更強大的前端全域搜尋。
4. **雲端存儲**: 整合 S3 等雲端儲存空間來處理附件上傳。

---
*文件更新日期: 2026-03-14*
