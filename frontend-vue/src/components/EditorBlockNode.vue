<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import draggable from 'vuedraggable';
import type { EditorBlock } from '../models/document.model';

// Use Marked and DOMPurify and HighlightJS
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

const props = defineProps<{
  modelValue: EditorBlock[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: EditorBlock[]): void;
  (e: 'trigger-save'): void;
  (e: 'focus-up', blockId: string): void;
  (e: 'focus-down', blockId: string): void;
  (e: 'split-block', blockId: string, index: number, contentBefore: string, contentAfter: string): void;
  (e: 'merge-block', blockId: string, index: number): void;
  (e: 'indent-block', blockId: string, index: number): void;
  (e: 'outdent-block', blockId: string, index: number): void;
}>();

const blocks = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const marked = new Marked({
  gfm: true,
  breaks: true,
});

try {
  mermaid.initialize({ startOnLoad: false, theme: 'dark' });
} catch (e) {
  console.warn('Mermaid init error:', e);
}

const textareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({});

const setRef = (el: any, id: string) => {
  if (el) {
    textareaRefs.value[id] = el as HTMLTextAreaElement;
  }
};

const editBlock = (block: EditorBlock) => {
  block.isEditing = true;
  nextTick(() => {
    const textarea = textareaRefs.value[block.id];
    if (textarea) {
      textarea.focus();
      adjustTextareaHeight(textarea);
    }
  });
};

const renderHtml = async (content: string) => {
  const rawHtml = await marked.parse(content || ' ');
  return DOMPurify.sanitize(rawHtml);
};

const applyPlugins = () => {
  nextTick(async () => {
    document.querySelectorAll('.markdown-body pre code:not(.language-mermaid)').forEach((el) => {
      // Avoid re-highlighting
      if (!el.classList.contains('hljs')) {
        hljs.highlightElement(el as HTMLElement);
      }
    });
    
    try {
      const mermaidNodes = document.querySelectorAll('.markdown-body pre code.language-mermaid');
      if (mermaidNodes.length > 0) {
        mermaidNodes.forEach((node) => {
          const pre = node.parentNode as HTMLElement;
          const graphDef = node.textContent || '';
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = graphDef;
          pre.replaceWith(div);
        });
        await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      }
    } catch (e) {
      console.warn('Mermaid rendering error:', e);
    }
  });
};

import { onMounted, onUpdated, onUnmounted } from 'vue';

const activeMenuId = ref<string | null>(null);

const toggleMenu = (event: MouseEvent, id: string) => {
  event.stopPropagation();
  activeMenuId.value = activeMenuId.value === id ? null : id;
};

const closeMenu = () => {
  activeMenuId.value = null;
};

const removeBlock = (index: number) => {
  blocks.value.splice(index, 1);
  activeMenuId.value = null;
  emit('trigger-save');
};

onMounted(() => {
  applyPlugins();
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});

onUpdated(() => applyPlugins());

const onBlur = async (block: EditorBlock) => {
  block.isEditing = false;
  block.html = await renderHtml(block.content);
  emit('trigger-save');
  applyPlugins();
};

const onKeydown = (event: KeyboardEvent, block: EditorBlock, index: number) => {
  const el = event.target as HTMLTextAreaElement;
  
  if (event.key === 'Enter' && !event.shiftKey) {
    const currentContent = el.value;
    const linesBeforeCursor = currentContent.substring(0, el.selectionStart).split('\n');
    const codeBlockCount = linesBeforeCursor.filter(l => l.trim().startsWith('```')).length;
    const isInsideCodeBlock = codeBlockCount % 2 === 1;
    
    if (isInsideCodeBlock) {
       // Let textarea handle newline normally inside code blocks
       return; 
    }

    event.preventDefault();
    const start = el.selectionStart;
    const contentBefore = currentContent.substring(0, start);
    const contentAfter = currentContent.substring(start);
    emit('split-block', block.id, index, contentBefore, contentAfter);
  }
  else if (event.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
    event.preventDefault();
    emit('merge-block', block.id, index);
  }
  else if (event.key === 'ArrowUp' && el.selectionStart === 0) {
    event.preventDefault();
    emit('focus-up', block.id);
  }
  else if (event.key === 'ArrowDown' && el.selectionStart === el.value.length) {
    event.preventDefault();
    emit('focus-down', block.id);
  }
  else if (event.key === 'Tab') {
    event.preventDefault();
    if (event.shiftKey) {
      emit('outdent-block', block.id, index);
    } else {
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        emit('indent-block', block.id, index);
      } else {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        block.content = block.content.substring(0, start) + '\t' + block.content.substring(end);
        nextTick(() => {
          el.selectionStart = el.selectionEnd = start + 1;
        });
      }
    }
  }
};

const adjustTextareaHeight = (el: HTMLTextAreaElement) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const onInput = (event: Event) => {
  adjustTextareaHeight(event.target as HTMLTextAreaElement);
  emit('trigger-save');
};

// Passthrough events from child recursively
const passTriggerSave = () => emit('trigger-save');
const passFocusUp = (id: string) => emit('focus-up', id);
const passFocusDown = (id: string) => emit('focus-down', id);
const passSplitBlock = (id: string, idx: number, cb: string, ca: string) => emit('split-block', id, idx, cb, ca);
const passMergeBlock = (id: string, idx: number) => emit('merge-block', id, idx);
const passIndentBlock = (id: string, idx: number) => emit('indent-block', id, idx);
const passOutdentBlock = (id: string, idx: number) => emit('outdent-block', id, idx);

const getBlockClass = (block: EditorBlock) => {
  const content = (block.content || '').trim();
  if (content.startsWith('# ')) return 'is-h1';
  if (content.startsWith('## ')) return 'is-h2';
  if (content.startsWith('### ')) return 'is-h3';
  return 'is-normal';
};

const reorderNumberedLists = (nodeList: EditorBlock[]) => {
  let currentNumber = 1;

  for (const block of nodeList) {
    const trimmed = (block.content || '').trim();
    // Match something like "1. ", "12. ", etc at the start
    const match = trimmed.match(/^(\d+)\.\s/);

    if (match) {
      const newContent = block.content.replace(/^(\s*)\d+\.\s/, `$1${currentNumber}. `);
      if (block.content !== newContent) {
        block.content = newContent;
        // Trigger HTML re-render for this block if content changed
        renderHtml(block.content).then(html => block.html = html);
      }
      currentNumber++;
    } else {
      currentNumber = 1;
    }

    if (block.children && block.children.length > 0) {
      reorderNumberedLists(block.children);
    }
  }
};

const onDragEnd = () => {
  reorderNumberedLists(blocks.value);
  emit('trigger-save');
};

</script>

<template>
  <draggable
    v-model="blocks"
    group="blocks"
    item-key="id"
    handle=".drag-handle"
    class="blocks-container"
    ghost-class="ghost-block"
    drag-class="drag-block"
    @end="onDragEnd"
  >
    <template #item="{ element, index }">
      <div class="editor-block-wrapper" :class="[getBlockClass(element), { 'active-menu-block': activeMenuId === element.id }]">
        <div class="drag-handle" :class="{ 'menu-open': activeMenuId === element.id }" @click="toggleMenu($event, element.id)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"></circle>
            <circle cx="9" cy="12" r="1.5"></circle>
            <circle cx="9" cy="18" r="1.5"></circle>
            <circle cx="15" cy="6" r="1.5"></circle>
            <circle cx="15" cy="12" r="1.5"></circle>
            <circle cx="15" cy="18" r="1.5"></circle>
          </svg>
          <div class="block-menu" v-if="activeMenuId === element.id" @click.stop>
            <button class="menu-item delete" @click="removeBlock(index)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              刪除區塊
            </button>
          </div>
        </div>

        <div class="block-content-area">
          <div
            v-show="!element.isEditing"
            @click="editBlock(element)"
            class="markdown-body rich-text-preview"
            :class="{ 'empty-placeholder': !element.content }"
            v-html="element.html || '<p><br></p>'"
            data-placeholder="輸入 '/' 獲得指令，或直接輸入內容..."
          ></div>

          <textarea
            v-show="element.isEditing"
            :ref="el => setRef(el, element.id)"
            class="raw-markdown-textarea"
            v-model="element.content"
            @blur="onBlur(element)"
            @keydown="onKeydown($event, element, index)"
            @input="onInput($event)"
            placeholder="輸入 '/' 獲得指令，或直接輸入內容..."
          ></textarea>

          <!-- Recursive children of this block -->
          <div class="nested-blocks" v-if="element.children && element.children.length > 0">
            <EditorBlockNode
              v-model="element.children"
              @trigger-save="passTriggerSave"
              @focus-up="passFocusUp"
              @focus-down="passFocusDown"
              @split-block="passSplitBlock"
              @merge-block="passMergeBlock"
              @indent-block="passIndentBlock"
              @outdent-block="passOutdentBlock"
            />
          </div>
        </div>
      </div>
    </template>
  </draggable>
</template>

<style scoped>
.blocks-container {
  min-height: 20px;
}

.editor-block-wrapper {
  display: flex;
  position: relative;
  /* Reduced bottom margin to 0 for a tighter block feel */
  margin-bottom: 0;
  padding: 2px 0;
  border-radius: 4px;
}

.editor-block-wrapper.active-menu-block {
  background-color: rgba(55, 53, 47, 0.08);
}

.drag-handle {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d3d3d3;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
  margin-right: 4px;
  position: absolute;
  left: -28px;
  top: 5px;
  height: 24px;
  border-radius: 4px;
}

.editor-block-wrapper.is-h1 .drag-handle {
  top: 13px;
}

.editor-block-wrapper.is-h2 .drag-handle {
  top: 8px;
}

.editor-block-wrapper.is-h3 .drag-handle {
  top: 6px;
}
.drag-handle:hover {
  background-color: rgba(55, 53, 47, 0.08);
}

.editor-block-wrapper:hover > .drag-handle,
.drag-handle.menu-open {
  opacity: 1;
}

.block-content-area {
  flex: 1;
  min-width: 0;
}

.rich-text-preview {
  padding: 3px 2px;
  border-radius: 4px;
  cursor: text;
  min-height: 28px;
  line-height: 1.5;
  color: #37352f;
}

.editor-block-wrapper.is-h1 .rich-text-preview {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
}

.editor-block-wrapper.is-h2 .rich-text-preview {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
}

.editor-block-wrapper.is-h3 .rich-text-preview {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}

.rich-text-preview.empty-placeholder::before {
  content: attr(data-placeholder);
  color: #d3d3d3;
  position: absolute;
  pointer-events: none;
}

:deep(.markdown-body p),
:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body ul),
:deep(.markdown-body ol),
:deep(.markdown-body pre),
:deep(.markdown-body blockquote) {
  margin-top: 0 !important;
  margin-bottom: 0px !important;
}

:deep(.markdown-body blockquote) {
  background-color: rgba(55, 53, 47, 0.08);
  border-left: 3px solid rgba(55, 53, 47, 0.8);
  padding: 8px 14px;
  margin: 4px 0;
  border-radius: 4px;
  color: #37352f;
}

:deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 14px;
}

:deep(.markdown-body th), :deep(.markdown-body td) {
  border: 1px solid rgba(55, 53, 47, 0.09);
  padding: 8px 12px;
  text-align: left;
}

:deep(.markdown-body th) {
  background-color: rgba(55, 53, 47, 0.04);
  font-weight: 600;
  color: rgba(55, 53, 47, 0.6);
}

:deep(.markdown-body tr:hover) {
  background-color: rgba(55, 53, 47, 0.03);
}

.raw-markdown-textarea {
  width: 100%;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  color: #37352f;
  padding: 3px 2px;
  overflow: hidden;
}

.editor-block-wrapper.is-h1 .raw-markdown-textarea {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
}

.editor-block-wrapper.is-h2 .raw-markdown-textarea {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
}

.editor-block-wrapper.is-h3 .raw-markdown-textarea {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}

.nested-blocks {
  margin-left: 24px;
  padding-left: 4px;
  border-left: 2px solid rgba(55, 53, 47, 0.16);
}

.block-menu {
  position: absolute;
  left: 28px;
  top: 0;
  background: white;
  box-shadow: 0 4px 12px rgba(15, 15, 15, 0.15), 0 0 0 1px rgba(15, 15, 15, 0.05);
  border-radius: 6px;
  padding: 4px;
  z-index: 100;
  min-width: 120px;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: #37352f;
  text-align: left;
}

.menu-item:hover {
  background: rgba(55, 53, 47, 0.08);
}

.menu-item.delete {
  color: #eb5757;
}

.menu-item svg {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.ghost-block {
  opacity: 0.5;
  background-color: rgba(55, 53, 47, 0.16);
  border-radius: 4px;
}

.drag-block {
  opacity: 1;
  background-color: #ffffff;
  box-shadow: 0 15px 30px rgba(15, 15, 15, 0.1), 0 0 0 1px rgba(15, 15, 15, 0.05);
  border-radius: 4px;
}
</style>
