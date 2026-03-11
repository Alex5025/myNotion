import { Component } from '@angular/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { EditorComponent } from './components/editor/editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SidebarComponent, EditorComponent],
  template: `
    <div class="app-layout">
      <app-sidebar></app-sidebar>
      <app-editor></app-editor>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class AppComponent {}
