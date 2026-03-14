<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDocumentsStore } from '../composables/useDocuments';
import type { Document } from '../models/document.model';

const { documents, activeDocument, loadDocuments, getDocument, createDocument, deleteDocument } = useDocumentsStore();

const collapsed = ref(false);

onMounted(() => {
  loadDocuments();
});

const selectDoc = async (doc: Document) => {
  if (doc.id) {
    await getDocument(doc.id);
  }
};

const createNew = async () => {
  const newDoc = await createDocument();
  if (newDoc && newDoc.id) {
    await getDocument(newDoc.id);
  }
};

const deleteDoc = async (event: Event, doc: Document) => {
  event.stopPropagation();
  if (doc.id) {
    await deleteDocument(doc.id);
  }
};

const toggleSidebar = () => {
  collapsed.value = !collapsed.value;
};
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div v-if="!collapsed" class="logo">
        <span class="logo-icon">📝</span>
        <span class="logo-text">我的筆記</span>
      </div>
      <button class="toggle-btn" @click="toggleSidebar" :title="collapsed ? '展開側邊欄' : '收起側邊欄'">
        <span class="toggle-icon">{{ collapsed ? '☰' : '◀' }}</span>
      </button>
    </div>

    <div v-if="!collapsed" class="sidebar-content">
      <button class="new-page-btn" @click="createNew">
        <span class="btn-icon">＋</span>
        <span>新增頁面</span>
      </button>

      <div class="section-label">我的頁面</div>

      <div class="page-list">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="page-item"
          :class="{ active: activeDocument && doc.id === activeDocument.id }"
          @click="selectDoc(doc)"
        >
          <span class="page-icon">{{ doc.icon || '📄' }}</span>
          <span class="page-title">{{ doc.title || '未命名文件' }}</span>
          <button class="delete-btn" @click="deleteDoc($event, doc)" title="刪除">✕</button>
        </div>
      </div>

      <div v-if="documents.length === 0" class="empty-state">
        <p>尚無任何頁面</p>
        <p class="hint">點擊「新增頁面」開始撰寫</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  height: 100vh;
  background-color: #f7f7f5;
  border-right: 1px solid #e1e1e1;
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow-x: hidden;
  box-sizing: border-box;
}

.sidebar.collapsed {
  width: 48px;
}

.sidebar-header {
  padding: 16px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  box-sizing: border-box;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #37352f;
  white-space: nowrap;
}

.toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #999;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: rgba(55, 53, 47, 0.08);
}

.sidebar-content {
  padding: 0 0 12px 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
}

.new-page-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 24px);
  margin: 0 12px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #37352f;
  font-weight: 500;
  text-align: left;
  transition: background 0.2s;
}

.new-page-btn:hover {
  background: rgba(55, 53, 47, 0.08);
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(55, 53, 47, 0.6);
  margin-top: 16px;
  margin-bottom: 4px;
  padding: 0 20px;
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-item {
  display: flex;
  align-items: center;
  padding: 6px 12px 6px 20px;
  cursor: pointer;
  color: #37352f;
  transition: background 0.1s;
}

.page-item:hover {
  background: rgba(55, 53, 47, 0.08);
}

.page-item.active {
  background: rgba(55, 53, 47, 0.08);
  font-weight: 600;
}

.page-icon {
  margin-right: 8px;
  font-size: 14px;
}

.page-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.delete-btn {
  opacity: 0;
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px;
  transition: opacity 0.2s, background 0.2s;
}

.page-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(55, 53, 47, 0.16);
  color: #eb5757;
}

.empty-state {
  margin-top: 24px;
  text-align: center;
  color: rgba(55, 53, 47, 0.6);
  font-size: 14px;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 4px;
}
</style>
