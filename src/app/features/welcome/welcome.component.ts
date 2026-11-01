import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-welcome',
  imports: [
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {}
