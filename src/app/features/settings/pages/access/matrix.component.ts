import { Component, inject, OnInit, signal } from '@angular/core';
import { AccessApiService, AccessMatrix, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { moduleLabel, reportAccessError } from './access-ui.util';
import { AccessNavComponent } from './access-nav.component';

/** Read-only overview: which role can read and which can write each module. */
@Component({
  selector: 'app-access-matrix',
  imports: [AccessNavComponent, NzCardModule, NzSpinModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'access.matrix.title' | translate" [subtitle]="'access.matrix.subtitle' | translate" />
    <app-access-nav />
    <nz-card>
      <nz-spin [nzSpinning]="loading()">
        <div class="matrix-scroll">
          <table class="matrix" data-test="matrix-table">
            <caption class="sr-only">
              {{ 'access.matrix.title' | translate }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'access.matrix.role' | translate }}</th>
                @for (module of matrix().modules; track module) {
                  <th scope="col" class="matrix-module" data-test="matrix-module">{{ label(module) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (role of matrix().roles; track role.key) {
                <tr data-test="matrix-row">
                  <th scope="row">
                    {{ role.name }}
                    @if (role.custom) {
                      <nz-tag>{{ 'access.matrix.custom' | translate }}</nz-tag>
                    }
                  </th>
                  @for (module of matrix().modules; track module) {
                    <td class="matrix-cell" [attr.data-module]="module">
                      @let access = role.access[module];
                      @if (access?.write) {
                        <span class="mark write" data-mark="write" [attr.title]="'access.matrix.write' | translate"
                          >R W</span
                        >
                      } @else if (access?.read) {
                        <span class="mark read" data-mark="read" [attr.title]="'access.matrix.read' | translate">R</span>
                      } @else {
                        <span class="mark none" data-mark="none" [attr.title]="'access.matrix.none' | translate">-</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-xs mt-3">{{ 'access.matrix.legend' | translate }}</p>
      </nz-spin>
    </nz-card>
  `,
  styles: `
    .matrix-scroll {
      overflow-x: auto;
    }
    .matrix {
      border-collapse: collapse;
      width: 100%;
    }
    .matrix th,
    .matrix td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
      text-align: center;
      white-space: nowrap;
    }
    .matrix th[scope='row'],
    .matrix th:first-child {
      text-align: left;
    }
    .matrix-module {
      font-weight: 500;
    }
    .mark.write {
      color: var(--ant-color-success, #52c41a);
      font-weight: 600;
    }
    .mark.read {
      color: var(--ant-color-primary, #1677ff);
    }
    .mark.none {
      color: var(--ant-color-text-quaternary, #bfbfbf);
    }
  `,
})
export class AccessMatrixComponent implements OnInit {
  private readonly api = inject(AccessApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly matrix = signal<AccessMatrix>({ modules: [], roles: [] });
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getMatrix().subscribe({
      next: (res) => {
        this.matrix.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportAccessError(err, this.message, this.i18n);
      },
    });
  }

  protected label(module: string): string {
    return moduleLabel(this.i18n, module);
  }
}
