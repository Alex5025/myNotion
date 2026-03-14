export interface Document {
  id?: number;
  title: string;
  content: string;
  icon: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditorBlock {
  id: string;
  content: string;
  html?: string;
  isEditing: boolean;
  children: EditorBlock[];
}
