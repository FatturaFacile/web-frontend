import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { TranslatePipe } from '@shared';
import { AcademyStore } from './academy.store';
import { parseMarkdown } from './academy.utils';

/** Side drawer with the contextual help of the page the user is on (`GET contextual-help?route=`). */
@Component({
  selector: 'app-contextual-help-drawer',
  imports: [NzDrawerModule, TranslatePipe],
  template: `
    <nz-drawer
      [nzVisible]="store.helpOpen()"
      [nzTitle]="store.help()?.title ?? ('ACADEMY.HELP_TITLE' | translate)"
      nzPlacement="right"
      [nzWidth]="400"
      (nzOnClose)="store.closeHelp()"
    >
      <ng-container *nzDrawerContent>
        @if (store.help(); as help) {
          <div data-testid="help-body">
            @for (block of blocks(help.body_markdown); track $index) {
              @switch (block.type) {
                @case ('list') {
                  <ul>
                    @for (line of block.lines; track $index) {
                      <li>{{ line }}</li>
                    }
                  </ul>
                }
                @case ('heading') {
                  <h3>{{ block.lines[0] }}</h3>
                }
                @default {
                  <p>{{ block.lines.join(' ') }}</p>
                }
              }
            }
          </div>
        } @else {
          <p data-testid="help-empty">{{ 'ACADEMY.HELP_EMPTY' | translate }}</p>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ContextualHelpDrawerComponent {
  protected readonly store = inject(AcademyStore);
  private readonly router = inject(Router);
  protected readonly blocks = parseMarkdown;

  constructor() {
    effect(() => {
      if (this.store.helpOpen()) {
        const route = this.router.url.split(/[?#]/)[0];
        // Reload on every opening so a language change is reflected.
        this.store.loadContextualHelp(route).subscribe({ error: () => this.store.help.set(null) });
      }
    });
  }
}
