import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [SidebarComponent, RouterOutlet],
  template: `
    <div class="layout">
      <app-sidebar />
      <main class="content"><router-outlet /></main>
    </div>
  `,
  styles: [`
    .layout { display: flex; min-height: 100vh; background: #f4f7fa; }
    .content { flex: 1; padding: 24px 32px; overflow-x: auto; }
  `]
})
export class MainLayoutComponent {}
