import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [SidebarComponent, RouterOutlet],
  template: `
    <div class="layout">
      <app-sidebar />
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      background: #f4f7fa;
    }
    .content {
      flex: 1;
      min-width: 0;
      padding: 24px 32px;
      overflow-y: auto;
      max-height: 100vh;
    }
    @media (max-width: 991.98px) {
      .content {
        max-height: none;
        min-height: 100vh;
        padding: 72px 20px 28px;
      }
    }
    @media (max-width: 575.98px) {
      .content { padding-inline: 14px; }
    }
  `]
})
export class MainLayoutComponent {
  readonly actualizacionAutorizacion = inject(AutorizacionActualizacionService);
}
