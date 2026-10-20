import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { AppStore, AuthStore } from '@core';
import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from './layout';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NzLayoutModule,
    HeaderComponent,
    SidebarComponent,
    BreadcrumbComponent,
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
}
