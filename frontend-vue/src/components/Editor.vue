<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDocumentsStore } from '../composables/useDocuments';
import type { EditorBlock } from '../models/document.model';
import EditorBlockNode from './EditorBlockNode.vue';
import draggable from 'vuedraggable';
import debounce from 'lodash-es/debounce';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

// 從全域 store 取得文件清單與更新方法
const { activeDocument, updateDocument } = useDocumentsStore();

// 當前文件標題
const docTitle = ref('');
// 當前文件的區塊樹狀結構
const blocks = ref<EditorBlock[]>([]);
// 解析中旗標，避免解析期間觸發不必要的儲存
let isParsing = false;

// 初始化 Marked 解析器，啟用 GitHub Flavored Markdown 與換行支援
const marked = new Marked({
  gfm: true,
  breaks: true,
});

// ── 工具函式 ───────────────────────────────────────────────────────────────

/** 產生隨機唯一 ID，用於每個區塊的識別 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * 將 Markdown 字串依空白行切割成多個區塊字串。
 * 程式碼區塊（``` ... ```）內的空白行不做切割。
 */
function splitMarkdownBlocks(content: string): string[] {
  const blocks: string[] = [];
  const lines = content.split('\n');
  let currentBlock: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // 偵測程式碼區塊的開始與結束
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    // 非程式碼區塊內的空白行視為區塊分隔符
    if (!inCodeBlock && line.trim() === '' && !line.includes('\t')) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  // 最後一個區塊（後面沒有空白行）也要加入
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  return blocks;
}

/**
 * 將 Markdown 字串解析成樹狀 EditorBlock 結構。
 * 以 Tab 縮排代表父子層級關係。
 */
function markdownToTree(content: string): EditorBlock[] {
  // 空內容時回傳一個空白區塊
  if (!content) return [{ id: generateId(), content: '', isEditing: false, children: [] }];

  const rawBlocks = splitMarkdownBlocks(content);
  const rootBlocks: EditorBlock[] = [];
  // path 用來追蹤當前的祖先鏈，以便正確掛載子區塊
  const path: { block: EditorBlock; depth: number }[] = [];

  for (const raw of rawBlocks) {
    if (!raw) continue;

    // 根據第一行的 Tab 縮排數量決定深度
    const match = raw.match(/^(\t*)/);
    const depth = match && match[1] ? match[1].length : 0;

    // 移除每行開頭的縮排 Tab，讓內容保持乾淨
    const blockIndentStr = '\t'.repeat(depth);
    const cleanContent = raw.split('\n').map(line => line.startsWith(blockIndentStr) ? line.substring(depth) : line).join('\n');

    const block: EditorBlock = {
      id: generateId(),
      content: cleanContent,
      isEditing: false,
      children: []
    };

    if (depth === 0) {
      // 根層級區塊直接加入 rootBlocks
      rootBlocks.push(block);
      path.length = 0;
      path.push({ block, depth });
    } else {
      // 往上找到合適的父節點（深度比當前小的最近祖先）
      let lastPath = path[path.length - 1];
      while (path.length > 0 && lastPath && lastPath.depth >= depth) {
        path.pop();
        lastPath = path[path.length - 1];
      }
      lastPath = path[path.length - 1];
      if (path.length > 0 && lastPath) {
        lastPath.block.children.push(block);
      } else {
        rootBlocks.push(block);
      }
      path.push({ block, depth });
    }
  }

  if (rootBlocks.length === 0) {
    return [{ id: generateId(), content: '', isEditing: false, children: [] }];
  }
  return rootBlocks;
}

/**
 * 將樹狀 EditorBlock 結構轉回 Markdown 字串。
 * 子層級以 Tab 縮排表示。
 */
function treeToMarkdown(nodeList: EditorBlock[], depth = 0): string {
  const indent = '\t'.repeat(depth);
  let result = '';
  for (const block of nodeList) {
    if (block.content !== undefined) {
      // 每行加上對應層級的縮排，區塊之間以空白行分隔
      result += block.content.split('\n').map(line => indent + line).join('\n') + '\n\n';
    }
    // 遞迴處理子區塊
    if (block.children && block.children.length > 0) {
      result += treeToMarkdown(block.children, depth + 1);
    }
  }
  return result;
}

// ── 文件監聽與載入 ────────────────────────────────────────────────────────

// 監聽目前開啟的文件 ID，切換文件時重新解析內容
watch(
  () => activeDocument.value?.id,
  () => {
    if (activeDocument.value) {
      docTitle.value = activeDocument.value.title || '';
      const newDocContent = activeDocument.value.content || '';

      const currentAssembled = treeToMarkdown(blocks.value).trim();
      const newTrimmed = newDocContent.trim();

      // 只有內容真正不同時才重新解析，避免游標跳動
      if (currentAssembled !== newTrimmed || blocks.value.length === 0) {
        isParsing = true;
        const newBlocks = markdownToTree(newDocContent);
        // 預先將所有區塊的 Markdown 渲染成 HTML
        Promise.all(newBlocks.map(recursivePreRender)).then(() => {
          blocks.value = newBlocks;
          isParsing = false;
        });
      }
    } else {
      blocks.value = [];
    }
  },
  { immediate: true }
);

/** 遞迴預渲染區塊及其所有子區塊的 HTML */
async function recursivePreRender(block: EditorBlock) {
  if (block.content) {
    const rawHtml = await marked.parse(block.content || ' ');
    block.html = DOMPurify.sanitize(rawHtml);
  }
  if (block.children) {
    await Promise.all(block.children.map(recursivePreRender));
  }
}

// ── 儲存（防抖處理）──────────────────────────────────────────────────────

/** 防抖儲存內容，1 秒內無操作才真正發送 API */
const saveContent = debounce(async () => {
  if (!activeDocument.value?.id || isParsing) return;
  const content = treeToMarkdown(blocks.value).trim();
  await updateDocument(activeDocument.value.id, { content });
}, 1000);

/** 防抖儲存標題，500ms 內無操作才真正發送 API */
const saveTitle = debounce(async () => {
  if (!activeDocument.value?.id) return;
  await updateDocument(activeDocument.value.id, { title: docTitle.value });
}, 500);

/** 觸發內容儲存（供子元件呼叫） */
function triggerSave() {
  saveContent();
}

/** 標題輸入事件處理 */
function onTitleChange(e: Event) {
  docTitle.value = (e.target as HTMLInputElement).value;
  saveTitle();
}

// ── 區塊樹操作 ────────────────────────────────────────────────────────────

/**
 * 在整棵樹中搜尋指定 ID 的區塊，
 * 回傳其所在的父陣列與索引位置。
 */
function findBlockLocation(nodeList: EditorBlock[], id: string): { parent: EditorBlock[]; index: number } | null {
  for (let i = 0; i < nodeList.length; i++) {
    const node = nodeList[i];
    if (!node) continue;
    if (node.id === id) return { parent: nodeList, index: i };
    if (node.children && node.children.length > 0) {
      const found = findBlockLocation(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 在游標位置將區塊一分為二（按下 Enter 時觸發）。
 * contentBefore 留在原區塊，contentAfter 放入新區塊。
 */
function splitBlock(id: string, _index: number, contentBefore: string, contentAfter: string) {
  const loc = findBlockLocation(blocks.value, id);
  if (loc) {
    const parentArr = loc.parent;
    const currentBlock = parentArr[loc.index];
    if (currentBlock) {
      currentBlock.content = contentBefore;
      const newBlock: EditorBlock = {
        id: generateId(),
        content: contentAfter,
        isEditing: true, // 新區塊立即進入編輯模式
        children: []
      };
      parentArr.splice(loc.index + 1, 0, newBlock);
      triggerSave();
    }
  }
}

/**
 * 將當前區塊與前一個區塊合併（游標在行首按 Backspace 時觸發）。
 * 同時將當前區塊的子區塊轉移給前一個區塊。
 */
function mergeBlock(id: string, _index: number) {
  const loc = findBlockLocation(blocks.value, id);
  if (loc && loc.index > 0) {
    const parentArr = loc.parent;
    const currentBlock = parentArr[loc.index];
    const prevBlock = parentArr[loc.index - 1];

    if (currentBlock && prevBlock) {
      prevBlock.content += currentBlock.content;
      prevBlock.children.push(...currentBlock.children);

      parentArr.splice(loc.index, 1);
      prevBlock.isEditing = true;
      triggerSave();
    }
  }
}

/**
 * 將區塊縮排一層（Tab 鍵觸發）。
 * 把當前區塊移入前一個區塊的 children 中。
 */
function indentBlock(id: string, _index: number) {
  const loc = findBlockLocation(blocks.value, id);
  if (loc && loc.index > 0) {
    const parentArr = loc.parent;
    const currentBlock = parentArr[loc.index];
    const prevBlock = parentArr[loc.index - 1];
    if (currentBlock && prevBlock) {
      parentArr.splice(loc.index, 1);
      prevBlock.children.push(currentBlock);
      triggerSave();
    }
  }
}

/**
 * 將區塊向外縮排一層（Shift+Tab 鍵觸發）。
 * 把當前區塊從父節點的 children 中移出，
 * 插入到父節點的後面（同一層）。
 */
function outdentBlock(id: string, _index: number) {
  // 用 path 陣列記錄從根到目標區塊的完整路徑
  const path: { parent: EditorBlock[]; index: number }[] = [];

  function search(list: EditorBlock[]): boolean {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node) continue;
      if (node.id === id) {
        path.push({ parent: list, index: i });
        return true;
      }
      if (node.children && node.children.length > 0) {
        path.push({ parent: list, index: i });
        if (search(node.children)) return true;
        path.pop();
      }
    }
    return false;
  }

  // 必須至少有兩層才能向外縮排
  if (search(blocks.value) && path.length > 1) {
    const currentLoc = path.pop();  // 當前區塊的位置
    const parentLoc = path.pop();   // 父區塊的位置

    if (currentLoc && parentLoc) {
      const parentArr = currentLoc.parent;
      const targetParentArr = parentLoc.parent;
      const spliced = parentArr.splice(currentLoc.index, 1);
      if (spliced.length > 0) {
        const blockToOutdent = spliced[0];
        if (blockToOutdent) {
          // 插入到父區塊的後面
          targetParentArr.splice(parentLoc.index + 1, 0, blockToOutdent);
          triggerSave();
        }
      }
    }
  }
}

// 鍵盤上下移焦點目前未實作（由 vuedraggable 拖拉取代）
function focusUp(_id: string) { }
function focusDown(_id: string) { }

// ── 取消縮排拖放區 ────────────────────────────────────────────────────────
// 編輯區底部的虛線框，作為獨立的 draggable 清單。
// 將任意區塊的 6 個小點圖示拖到此區域後，
// 該區塊會被移至根層級（完全取消縮排）。
const outdentZoneList = ref<EditorBlock[]>([]);
// 控制拖曳懸停時的高亮樣式
const isOverOutdentZone = ref(false);

/**
 * 區塊被拖入取消縮排區時觸發。
 * vuedraggable 已將區塊移入 outdentZoneList，
 * 此函式將其取出並附加到根層級 blocks 末尾。
 */
function onDropToOutdentZone() {
  for (const block of outdentZoneList.value) {
    blocks.value.push(block);
  }
  outdentZoneList.value = [];
  triggerSave();
}
// ──────────────────────────────────────────────────────────────────────────

/** 將目前文件匯出為 Markdown 檔案並下載 */
function exportMarkdown() {
  if (!activeDocument.value) return;
  const content = treeToMarkdown(blocks.value).trim();
  const title = docTitle.value || '未命名文件';

  const markdownContent = `# ${title}\n---\n\n${content}`;
  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.md`;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

</script>

<template>
  <div class="editor-container">
    <div class="editor-topbar">
      <div class="doc-title-area">
        <span class="breadcrumb-item">我的筆記</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">{{ docTitle || '未命名文件' }}</span>
      </div>
      <div class="editor-actions">
        <button class="export-btn" @click="exportMarkdown" v-if="activeDocument">
          匯出
        </button>
        <div class="editor-status">
          <span class="status-msg" v-if="activeDocument">已儲存</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-editor" v-if="!activeDocument">
      <div class="empty-content">
        <h2>選擇或建立筆記</h2>
        <p>點擊側邊欄的新增按鈕開始您的創作旅程</p>

        <div class="shortcut-hints">
          <div class="hint-item">
            <span class="hint-key"># 空白</span>
            <span class="hint-desc">建立大標題</span>
          </div>
          <div class="hint-item">
            <span class="hint-key">> 空白</span>
            <span class="hint-desc">建立區塊引用</span>
          </div>
          <div class="hint-item">
            <span class="hint-key">Tab / Shift+Tab</span>
            <span class="hint-desc">縮排 / 取消縮排</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Editor Area -->
    <div class="editor-scroll-area" v-if="activeDocument">
      <div class="notion-document">

        <input type="text" class="document-main-title" v-model="docTitle" @input="onTitleChange" placeholder="未命名文件">

        <div class="blocks-root-container">
          <EditorBlockNode v-model="blocks" @trigger-save="triggerSave" @split-block="splitBlock"
            @merge-block="mergeBlock" @indent-block="indentBlock" @outdent-block="outdentBlock" @focus-up="focusUp"
            @focus-down="focusDown" />
        </div>

        <!-- Outdent Drop Zone -->
        <draggable
          v-model="outdentZoneList"
          group="blocks"
          item-key="id"
          class="outdent-drop-zone"
          :class="{ 'outdent-drop-zone--over': isOverOutdentZone }"
          ghost-class="ghost-block-zone"
          @add="onDropToOutdentZone"
          @dragenter="isOverOutdentZone = true"
          @dragleave="isOverOutdentZone = false"
          @drop="isOverOutdentZone = false"
        >
          <template #item="{}">
            <div></div>
          </template>
          <template #header>
            <div class="outdent-drop-zone__inner">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="outdent-drop-zone__icon">
                <circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>
                <circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
              <span>拖曳至此以取消縮排至最上層</span>
            </div>
          </template>
        </draggable>

      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #e1e1e1;
  background-color: white;
}

.doc-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(55, 53, 47, 0.6);
}

.breadcrumb-item,
.breadcrumb-current {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}

.breadcrumb-item:hover,
.breadcrumb-current:hover {
  background: rgba(55, 53, 47, 0.08);
}

.breadcrumb-current {
  color: #37352f;
}



.editor-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.export-btn {
  background: transparent;
  border: 1px solid #e1e1e1;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.export-btn:hover {
  background: rgba(55, 53, 47, 0.08);
}

.status-msg {
  font-size: 12px;
  color: #999;
}

.empty-editor {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  text-align: center;
  color: rgba(55, 53, 47, 0.6);
}

.shortcut-hints {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(55, 53, 47, 0.04);
  padding: 16px;
  border-radius: 8px;
}

.hint-item {
  display: flex;
  justify-content: space-between;
  gap: 32px;
  font-size: 14px;
}

.hint-key {
  font-family: monospace;
  background: rgba(55, 53, 47, 0.08);
  padding: 0 4px;
  border-radius: 4px;
}

.editor-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
}

.notion-document {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 96px;
  padding-bottom: 30vh;
}

.document-main-title {
  font-size: 40px;
  font-weight: 700;
  margin-bottom: 30px;
  color: #37352f;
  outline: none;
  border: none;
  background: transparent;
  width: 100%;
  padding: 0;
  font-family: inherit;
}

.document-main-title::placeholder {
  color: rgba(55, 53, 47, 0.2);
}

.blocks-root-container {
  min-height: 200px;
}

/* Outdent Drop Zone */
.outdent-drop-zone {
  margin-top: 24px;
  min-height: 52px;
  border: 2px dashed rgba(55, 53, 47, 0.15);
  border-radius: 8px;
  transition: border-color 0.2s, background 0.2s;
  cursor: default;
}

.outdent-drop-zone--over,
.outdent-drop-zone:has(.ghost-block-zone) {
  border-color: #6c8ebf;
  background: rgba(108, 142, 191, 0.08);
}

.outdent-drop-zone__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 12px;
  color: rgba(55, 53, 47, 0.35);
  font-size: 13px;
  pointer-events: none;
  user-select: none;
  transition: color 0.2s;
}

.outdent-drop-zone--over .outdent-drop-zone__inner {
  color: #6c8ebf;
}

.outdent-drop-zone__icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.ghost-block-zone {
  display: none;
}
</style>
