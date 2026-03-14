<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDocumentsStore } from '../composables/useDocuments';
import type { EditorBlock } from '../models/document.model';
import EditorBlockNode from './EditorBlockNode.vue';
import debounce from 'lodash-es/debounce';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const { activeDocument, updateDocument } = useDocumentsStore();

const docTitle = ref('');
const blocks = ref<EditorBlock[]>([]);
let isParsing = false;

const marked = new Marked({
  gfm: true,
  breaks: true,
});

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function splitMarkdownBlocks(content: string): string[] {
  const blocks: string[] = [];
  const lines = content.split('\n');
  let currentBlock: string[] = [];
  let inCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    
    if (!inCodeBlock && line.trim() === '' && !line.includes('\t')) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  return blocks;
}

function markdownToTree(content: string): EditorBlock[] {
  if (!content) return [{ id: generateId(), content: '', isEditing: false, children: [] }];
  
  const rawBlocks = splitMarkdownBlocks(content);
  const rootBlocks: EditorBlock[] = [];
  const path: { block: EditorBlock; depth: number }[] = [];
  
  for (const raw of rawBlocks) {
    if (!raw) continue;
    
    // Determine depth based on the first line's indentation
    const match = raw.match(/^(\t*)/);
    const depth = match && match[1] ? match[1].length : 0;
    
    const blockIndentStr = '\t'.repeat(depth);
    const cleanContent = raw.split('\n').map(line => line.startsWith(blockIndentStr) ? line.substring(depth) : line).join('\n');
    
    const block: EditorBlock = {
      id: generateId(),
      content: cleanContent,
      isEditing: false,
      children: []
    };
    
    if (depth === 0) {
      rootBlocks.push(block);
      path.length = 0;
      path.push({ block, depth });
    } else {
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

function treeToMarkdown(nodeList: EditorBlock[], depth = 0): string {
  const indent = '\t'.repeat(depth);
  let result = '';
  for (const block of nodeList) {
    if (block.content !== undefined) {
      result += block.content.split('\n').map(line => indent + line).join('\n') + '\n\n';
    }
    if (block.children && block.children.length > 0) {
      result += treeToMarkdown(block.children, depth + 1);
    }
  }
  return result;
}

watch(
  () => activeDocument.value?.id,
  () => {
    if (activeDocument.value) {
      docTitle.value = activeDocument.value.title || '';
      const newDocContent = activeDocument.value.content || '';
      
      const currentAssembled = treeToMarkdown(blocks.value).trim();
      const newTrimmed = newDocContent.trim();
      
      if (currentAssembled !== newTrimmed || blocks.value.length === 0) {
        isParsing = true;
        const newBlocks = markdownToTree(newDocContent);
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

async function recursivePreRender(block: EditorBlock) {
  if (block.content) {
    const rawHtml = await marked.parse(block.content || ' ');
    block.html = DOMPurify.sanitize(rawHtml);
  }
  if (block.children) {
    await Promise.all(block.children.map(recursivePreRender));
  }
}

const saveContent = debounce(async () => {
  if (!activeDocument.value?.id || isParsing) return;
  const content = treeToMarkdown(blocks.value).trim();
  await updateDocument(activeDocument.value.id, { content });
}, 1000);

const saveTitle = debounce(async () => {
  if (!activeDocument.value?.id) return;
  await updateDocument(activeDocument.value.id, { title: docTitle.value });
}, 500);

function triggerSave() {
  saveContent();
}

function onTitleChange(e: Event) {
  docTitle.value = (e.target as HTMLInputElement).value;
  saveTitle();
}

// Tree operations

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
        isEditing: true,
        children: []
      };
      parentArr.splice(loc.index + 1, 0, newBlock);
      triggerSave();
    }
  }
}

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

function outdentBlock(id: string, _index: number) {
  // To outdent, we must remove it from parent and place after parent.
  // Finding parent requires tracking path
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
  
  if (search(blocks.value) && path.length > 1) {
    const currentLoc = path.pop();
    const parentLoc = path.pop();
    
    if (currentLoc && parentLoc) {
      const parentArr = currentLoc.parent;
      const targetParentArr = parentLoc.parent;
      const spliced = parentArr.splice(currentLoc.index, 1);
      if (spliced.length > 0) {
        const blockToOutdent = spliced[0];
        if (blockToOutdent) {
          targetParentArr.splice(parentLoc.index + 1, 0, blockToOutdent);
          triggerSave();
        }
      }
    }
  }
}

// Focus handling ignored for simplicity of manual textarea operations
function focusUp(_id: string) {}
function focusDown(_id: string) {}

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
          <div class="hint-item"><span class="hint-key"># 空白</span><span class="hint-desc">建立大標題</span></div>
          <div class="hint-item"><span class="hint-key">> 空白</span><span class="hint-desc">建立區塊引用</span></div>
          <div class="hint-item"><span class="hint-key">Tab / Shift+Tab</span><span class="hint-desc">縮排 / 取消縮排</span></div>
        </div>
      </div>
    </div>

    <!-- Document Editor Area -->
    <div class="editor-scroll-area" v-if="activeDocument">
      <div class="notion-document">
        
        <input 
          type="text" 
          class="document-main-title" 
          v-model="docTitle" 
          @input="onTitleChange"
          placeholder="未命名文件"
        >

        <div class="blocks-root-container">
            <EditorBlockNode
              v-model="blocks"
              @trigger-save="triggerSave"
              @split-block="splitBlock"
              @merge-block="mergeBlock"
              @indent-block="indentBlock"
              @outdent-block="outdentBlock"
              @focus-up="focusUp"
              @focus-down="focusDown"
            />
        </div>
        
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

.breadcrumb-item, .breadcrumb-current {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}

.breadcrumb-item:hover, .breadcrumb-current:hover {
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
</style>
