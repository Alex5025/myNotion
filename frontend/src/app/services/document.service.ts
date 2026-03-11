import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Document } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private apiUrl = 'http://localhost:8081/api/documents';

  private documentsSubject = new BehaviorSubject<Document[]>([]);
  public documents$ = this.documentsSubject.asObservable();

  private activeDocSubject = new BehaviorSubject<Document | null>(null);
  public activeDocument$ = this.activeDocSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadDocuments(): void {
    this.http.get<Document[]>(this.apiUrl).subscribe(docs => {
      this.documentsSubject.next(docs);
    });
  }

  getDocument(id: number): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${id}`).pipe(
      tap(doc => this.activeDocSubject.next(doc))
    );
  }

  createDocument(): Observable<Document> {
    return this.http.post<Document>(this.apiUrl, {}).pipe(
      tap(() => this.loadDocuments())
    );
  }

  updateDocument(id: number, updates: Partial<Document>): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/${id}`, updates).pipe(
      tap(doc => {
        this.activeDocSubject.next(doc);
        this.loadDocuments();
      })
    );
  }

  deleteDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        if (this.activeDocSubject.value?.id === id) {
          this.activeDocSubject.next(null);
        }
        this.loadDocuments();
      })
    );
  }

  setActiveDocument(doc: Document): void {
    this.activeDocSubject.next(doc);
  }
}
