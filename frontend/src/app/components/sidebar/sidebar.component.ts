import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DocumentService } from '../../services/document.service';
import { Document } from '../../models/document.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  documents: Document[] = [];
  activeDocId: number | null = null;
  collapsed = false;
  private subs: Subscription[] = [];

  constructor(private documentService: DocumentService) {}

  ngOnInit(): void {
    this.documentService.loadDocuments();

    this.subs.push(
      this.documentService.documents$.subscribe(docs => {
        this.documents = docs;
      })
    );

    this.subs.push(
      this.documentService.activeDocument$.subscribe(doc => {
        this.activeDocId = doc?.id ?? null;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  selectDocument(doc: Document): void {
    if (doc.id) {
      this.documentService.getDocument(doc.id).subscribe();
    }
  }

  createNew(): void {
    this.documentService.createDocument().subscribe(doc => {
      if (doc.id) {
        this.documentService.getDocument(doc.id).subscribe();
      }
    });
  }

  deleteDocument(event: Event, doc: Document): void {
    event.stopPropagation();
    if (doc.id) {
      this.documentService.deleteDocument(doc.id).subscribe();
    }
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
  }
}
