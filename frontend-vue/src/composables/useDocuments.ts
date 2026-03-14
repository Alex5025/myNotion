import { ref } from 'vue';
import axios from 'axios';
import type { Document } from '../models/document.model';

const API_URL = 'http://localhost:8081/api/documents';

export function useDocuments() {
  const documents = ref<Document[]>([]);
  const activeDocument = ref<Document | null>(null);
  
  const loadDocuments = async () => {
    try {
      const response = await axios.get<Document[]>(API_URL);
      documents.value = response.data;
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const getDocument = async (id: number) => {
    try {
      const response = await axios.get<Document>(`${API_URL}/${id}`);
      activeDocument.value = response.data;
      return response.data;
    } catch (error) {
      console.error(`Failed to load document ${id}:`, error);
      return null;
    }
  };

  const createDocument = async () => {
    try {
      const response = await axios.post<Document>(API_URL, {});
      await loadDocuments();
      return response.data;
    } catch (error) {
      console.error('Failed to create document:', error);
      return null;
    }
  };

  const updateDocument = async (id: number, updates: Partial<Document>) => {
    try {
      const response = await axios.put<Document>(`${API_URL}/${id}`, updates);
      if (activeDocument.value && activeDocument.value.id === id) {
        activeDocument.value = { ...activeDocument.value, ...response.data };
      }
      await loadDocuments();
      return response.data;
    } catch (error) {
      console.error(`Failed to update document ${id}:`, error);
      return null;
    }
  };

  const deleteDocument = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      if (activeDocument.value && activeDocument.value.id === id) {
        activeDocument.value = null;
      }
      await loadDocuments();
    } catch (error) {
      console.error(`Failed to delete document ${id}:`, error);
    }
  };

  const setActiveDocument = (doc: Document | null) => {
    activeDocument.value = doc;
  };

  return {
    documents,
    activeDocument,
    loadDocuments,
    getDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    setActiveDocument
  };
}

// Global state instance to share across components
const documentsStore = useDocuments();
export function useDocumentsStore() {
  return documentsStore;
}
