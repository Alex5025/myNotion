import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DocumentService } from '../../services/document.service';
import { Document } from '../../models/document.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

export interface EditorBlock {
  id: string;
  content: string;
  html?: SafeHtml;
  isEditing: boolean;
}

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent implements OnInit, OnDestroy, AfterViewInit {
  activeDoc: Document | null = null;
  docTitle = '';
  blocks: EditorBlock[] = [];
  
  private subs: Subscription[] = [];
  private contentChanged = new Subject<string>();
  private titleChanged = new Subject<string>();
  private marked: Marked;

  @ViewChildren('blockTextareas') blockTextareas!: QueryList<ElementRef<HTMLTextAreaElement>>;

  constructor(
    private documentService: DocumentService,
    private sanitizer: DomSanitizer
  ) {
    this.marked = new Marked({
      gfm: true,
      breaks: true,
    });
    // Initialize Mermaid
    try {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    } catch (e) {
      console.warn('Mermaid init error:', e);
    }
  }

  ngOnInit(): void {
    this.subs.push(
      this.documentService.activeDocument$.subscribe(doc => {
        this.activeDoc = doc;
        if (doc) {
          this.docTitle = doc.title || '';
          const newDocContent = doc.content || '';
          
          if (this.assembleDocumentConent() !== newDocContent) {
            this.parseToBlocks(newDocContent);
          }
        } else {
          this.blocks = [];
        }
      })
    );

    // Debounced auto-save for content
    this.subs.push(
      this.contentChanged.pipe(
        debounceTime(1000),
        distinctUntilChanged()
      ).subscribe(content => {
        if (this.activeDoc?.id) {
          this.documentService.updateDocument(this.activeDoc.id, { content }).subscribe();
        }
      })
    );

    // Debounced auto-save for title
    this.subs.push(
      this.titleChanged.pipe(
        debounceTime(500),
        distinctUntilChanged()
      ).subscribe(title => {
        if (this.activeDoc?.id) {
          this.documentService.updateDocument(this.activeDoc.id, { title }).subscribe();
        }
      })
    );
  }

  ngAfterViewInit(): void {
    // Initial render is handled by parseToBlocks calling renderBlock
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  onTitleChange(value: string): void {
    this.docTitle = value;
    this.titleChanged.next(value);
  }

  // --- Block Management ---

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private parseToBlocks(content: string) {
    if (!content) {
      this.blocks = [this.createEmptyBlock()];
    } else {
      // Split by double newline to separate paragraphs/blocks
      const rawBlocks = content.split('\n\n');
      this.blocks = rawBlocks.map(raw => ({
        id: this.generateId(),
        content: raw,
        isEditing: false
      }));
    }
    
    // Render all blocks initially
    this.blocks.forEach((_, i) => this.renderBlock(i));
  }

  private assembleDocumentConent(): string {
    return this.blocks.map(b => b.content).join('\n\n');
  }

  private triggerAutoSave() {
    this.contentChanged.next(this.assembleDocumentConent());
  }

  createEmptyBlock(): EditorBlock {
    return {
      id: this.generateId(),
      content: '',
      isEditing: false
    };
  }

  editBlock(index: number) {
    // Close other blocks
    this.blocks.forEach((b, i) => {
      if (i !== index && b.isEditing) {
        this.renderBlock(i);
      }
    });

    this.blocks[index].isEditing = true;
    
    setTimeout(() => {
      const textarea = this.blockTextareas.toArray()[index];
      if (textarea) {
        textarea.nativeElement.focus();
        this.adjustTextareaHeight(textarea.nativeElement);
      }
    }, 0);
  }

  async renderBlock(index: number) {
    const block = this.blocks[index];
    block.isEditing = false;
    
    if (!block.content.trim() && this.blocks.length > 1) {
      // Empty blocks get cleaned up if it's not the only block, handled in keydown
    }

    const rawHtml = await this.marked.parse(block.content || ' ');
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    block.html = this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
    
    this.triggerAutoSave();
    
    setTimeout(async () => {
      this.highlightCodes();
      await this.renderMermaid();
    }, 0);
  }

  // --- Drag and Drop ---
  onDrop(event: CdkDragDrop<EditorBlock[]>) {
    moveItemInArray(this.blocks, event.previousIndex, event.currentIndex);
    this.triggerAutoSave();
  }

  private async renderMermaid() {
    try {
      const mermaidNodes = document.querySelectorAll('.markdown-body pre code.language-mermaid');
      if (mermaidNodes.length === 0) return;
      
      // Transform <pre><code class="language-mermaid"> into <div class="mermaid">
      mermaidNodes.forEach((node) => {
        const pre = node.parentNode as HTMLElement;
        const graphDefinition = node.textContent || '';
        
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = graphDefinition;
        
        pre.parentNode?.replaceChild(div, pre);
      });
      
      // Render the diagrams
      await mermaid.run({
        querySelector: '.mermaid',
        suppressErrors: true
      });
    } catch (e) {
      console.warn('Mermaid rendering error:', e);
    }
  }

  private highlightCodes() {
    document.querySelectorAll('.markdown-body pre code:not(.language-mermaid)').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  }
  
  // --- Keyboard & Focus Management ---
  onBlockKeydown(event: KeyboardEvent, index: number) {
    const el = event.target as HTMLTextAreaElement;
    
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      
      // Split content if cursor is in middle of block
      const start = el.selectionStart;
      const currentContent = el.value;
      
      this.blocks[index].content = currentContent.substring(0, start);
      this.renderBlock(index);
      
      const newBlock = this.createEmptyBlock();
      newBlock.content = currentContent.substring(start);
      this.blocks.splice(index + 1, 0, newBlock);
      
      this.editBlock(index + 1);
      
    } else if (event.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && index > 0) {
      event.preventDefault();
      // Merge with previous block
      const prevBlock = this.blocks[index - 1];
      const prevLength = prevBlock.content.length;
      prevBlock.content += this.blocks[index].content;
      
      this.blocks.splice(index, 1);
      this.editBlock(index - 1);
      
      setTimeout(() => {
        const prevEl = this.blockTextareas.toArray()[index - 1]?.nativeElement;
        if (prevEl) {
          prevEl.selectionStart = prevEl.selectionEnd = prevLength;
        }
      }, 0);
      
    } else if (event.key === 'ArrowUp' && el.selectionStart === 0 && index > 0) {
      event.preventDefault();
      this.editBlock(index - 1);
    } else if (event.key === 'ArrowDown' && el.selectionStart === el.value.length && index < this.blocks.length - 1) {
      event.preventDefault();
      this.editBlock(index + 1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      this.blocks[index].content = this.blocks[index].content.substring(0, start) + '\t' + this.blocks[index].content.substring(end);
      
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 1;
      }, 0);
    }
  }

  adjustTextareaHeight(el: HTMLTextAreaElement) {
    if(!el) return;
    el.style.height = 'auto'; 
    el.style.height = el.scrollHeight + 'px';
  }

  exportMarkdown() {
    if (!this.activeDoc) return;
    
    const content = this.assembleDocumentConent();
    const title = this.docTitle || '未命名文件';
    
    const markdownContent = `# ${title}\n---\n\n${content}`;
    
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
