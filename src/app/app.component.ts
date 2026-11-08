import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { AppStore, AuthStore } from '@core';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';
import { TwoFactorSetupModalComponent } from './features/auth/components/two-factor-setup-modal/two-factor-setup-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NzLayoutModule,
    HeaderComponent,
    SidebarComponent,
    BreadcrumbComponent,
    TwoFactorSetupModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly appStore = inject(AppStore);
  readonly authStore = inject(AuthStore);

  ngOnInit(): void {
    this.authStore.applySavedTheme();
  }

  onGlobal2FASetupCompleted(): void {
    this.authStore.setTwoFactorSetupRequired(false);
  }
}
