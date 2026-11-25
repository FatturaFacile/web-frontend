import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  SF_PDFA_KINDS,
  SfArtifact,
  SfPdfaKind,
  SfPdfaPayload,
  TranslateService,
} from '@core';
import { downloadBlob, TranslatePipe } from '@shared';
import { MinutesWizardComponent } from './minutes-wizard.component';
import { PackageStore } from './package.store';
import {
  groupIssues,
  routeDossierId,
  SfOutcome,
  shortSha,
  sizeText,
  STATUTORY_FINANCIALS_MODULE,
  validationColor,
} from './statutory-financials.util';
import { WorkspaceStore } from './workspace.store';

/**
 * The deposit package: validate and export the XBRL with its validation report, generate the PDF/A documents (including
 * the minutes generator), verify the stored artifacts against their PDF/A profile and download them.
 */
@Component({
  selector: 'app-sf-package',
  imports: [
    MinutesWizardComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [PackageStore],
  styleUrl: './statutory-financials.scss',
  template: `
    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        [nzDescription]="outcome.detail"
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.xbrl' | translate">
        <div class="actions">
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="readOnly() || store.exporting()"
            [nzLoading]="store.exporting()"
            (click)="exportXbrl()"
          >
            {{ 'statutoryFinancials.action.exportXbrl' | translate }}
          </button>
          @if (store.xbrlArtifact(); as xbrl) {
            <button
              nz-button
              type="button"
              [disabled]="store.working() === xbrl.id"
              (click)="download(xbrl)"
            >
              {{ 'statutoryFinancials.action.downloadXbrl' | translate }}
            </button>
          }
        </div>

        @if (store.report(); as report) {
          <div class="stats-grid">
            <div>
              <span class="muted">{{ 'statutoryFinancials.field.validation' | translate }}</span>
              <nz-tag [nzColor]="color(report.status)">{{
                'statutoryFinancials.validation.' + report.status | translate
              }}</nz-tag>
            </div>
            <nz-statistic
              [nzTitle]="'statutoryFinancials.validation.count.errors' | translate"
              [nzValue]="report.errors.length"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'statutoryFinancials.validation.count.warnings' | translate"
              [nzValue]="report.warnings.length"
            ></nz-statistic>
            <nz-statistic
              [nzTitle]="'statutoryFinancials.validation.count.facts' | translate"
              [nzValue]="report.facts"
            ></nz-statistic>
          </div>
          <p class="muted">
            {{ 'statutoryFinancials.preview.taxonomyVersion' | translate }}:
            {{ report.taxonomy_version }} ·
            {{ 'statutoryFinancials.preview.entryPoint' | translate }}:
            <span class="mono">{{ report.entry_point }}</span>
          </p>

          @for (group of errorGroups(); track group.category) {
            <h3 class="section-title">
              {{ 'statutoryFinancials.validation.count.errors' | translate }} ·
              {{ 'statutoryFinancials.issueCategory.' + group.category | translate }}
            </h3>
            <nz-table
              nzSize="small"
              [nzData]="group.issues"
              [nzFrontPagination]="false"
              [nzShowPagination]="false"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'statutoryFinancials.validation.code' | translate }}</th>
                  <th scope="col">{{ 'statutoryFinancials.indicators.message' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (issue of group.issues; track $index) {
                  <tr>
                    <td>
                      <span class="mono">{{ issue.code }}</span>
                    </td>
                    <td>{{ issue.message }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @for (group of warningGroups(); track group.category) {
            <h3 class="section-title">
              {{ 'statutoryFinancials.validation.count.warnings' | translate }} ·
              {{ 'statutoryFinancials.issueCategory.' + group.category | translate }}
            </h3>
            <nz-table
              nzSize="small"
              [nzData]="group.issues"
              [nzFrontPagination]="false"
              [nzShowPagination]="false"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'statutoryFinancials.validation.code' | translate }}</th>
                  <th scope="col">{{ 'statutoryFinancials.indicators.message' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (issue of group.issues; track $index) {
                  <tr>
                    <td>
                      <span class="mono">{{ issue.code }}</span>
                    </td>
                    <td>{{ issue.message }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        } @else {
          <nz-empty
            [nzNotFoundContent]="'statutoryFinancials.empty.validation' | translate"
          ></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.pdfa' | translate">
        <div class="actions">
          @for (kind of singleKinds; track kind) {
            <button
              nz-button
              type="button"
              [disabled]="readOnly() || store.generating()"
              (click)="generate({ kinds: [kind] })"
            >
              {{ 'statutoryFinancials.pdfaKind.' + kind | translate }}
            </button>
          }
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="readOnly() || store.generating()"
            (click)="openMinutes()"
          >
            {{ 'statutoryFinancials.action.minutesWizard' | translate }}
          </button>
        </div>

        <nz-table
          nzSize="small"
          [nzData]="store.pdfaArtifacts()"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
          [nzScroll]="{ x: '860px' }"
        >
          <caption class="visually-hidden">
            {{
              'statutoryFinancials.section.pdfa' | translate
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ 'statutoryFinancials.artifact.file' | translate }}</th>
              <th scope="col">{{ 'statutoryFinancials.artifact.kind' | translate }}</th>
              <th scope="col" class="num">{{ 'statutoryFinancials.artifact.size' | translate }}</th>
              <th scope="col">SHA-256</th>
              <th scope="col">{{ 'statutoryFinancials.artifact.conformance' | translate }}</th>
              <th scope="col">{{ 'statutoryFinancials.artifact.verification' | translate }}</th>
              <th scope="col">
                <span class="visually-hidden">{{
                  'statutoryFinancials.field.actions' | translate
                }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (artifact of store.pdfaArtifacts(); track artifact.id) {
              <tr>
                <th scope="row">{{ artifact.file_name }}</th>
                <td>{{ 'statutoryFinancials.artifactKind.' + artifact.kind | translate }}</td>
                <td class="num">{{ size(artifact.size_bytes) }}</td>
                <td>
                  <span class="mono" [attr.title]="artifact.sha256">{{
                    sha(artifact.sha256)
                  }}</span>
                </td>
                <td>
                  @if (artifact.pdfa_conformance) {
                    <nz-tag nzColor="geekblue">{{ artifact.pdfa_conformance }}</nz-tag>
                  }
                </td>
                <td>
                  @if (artifact.verification; as verification) {
                    <nz-tag [nzColor]="verification.compliant ? 'green' : 'red'">
                      {{
                        (verification.compliant
                          ? 'statutoryFinancials.artifact.compliant'
                          : 'statutoryFinancials.artifact.notCompliant'
                        ) | translate
                      }}
                    </nz-tag>
                  } @else {
                    <nz-tag>{{ 'statutoryFinancials.artifact.notVerified' | translate }}</nz-tag>
                  }
                </td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="store.working() === artifact.id"
                    (click)="verify(artifact)"
                  >
                    {{ 'statutoryFinancials.action.verify' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="store.working() === artifact.id"
                    (click)="download(artifact)"
                  >
                    {{ 'statutoryFinancials.action.download' | translate }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">{{ 'statutoryFinancials.empty.artifacts' | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>

        @for (artifact of verified(); track artifact.id) {
          <h3 class="section-title">
            {{ 'statutoryFinancials.artifact.checks' | translate }} · {{ artifact.file_name }}
            <small class="muted">{{ artifact.verification?.profile }}</small>
          </h3>
          <ul class="check-list">
            @for (check of artifact.verification?.checks ?? []; track check.id) {
              <li>
                <nz-tag [nzColor]="check.passed ? 'green' : 'red'">
                  {{
                    (check.passed
                      ? 'statutoryFinancials.artifact.pass'
                      : 'statutoryFinancials.artifact.fail'
                    ) | translate
                  }}
                </nz-tag>
                <span>{{ checkLabel(check.id) }}</span>
                @if (check.detail) {
                  <small class="muted">{{ check.detail }}</small>
                }
              </li>
            }
          </ul>
        }
      </nz-card>
    </nz-spin>

    <app-sf-minutes-wizard
      [open]="minutesOpen()"
      [dossier]="workspace.dossier()"
      [templates]="templates()"
      [generating]="store.generating()"
      [error]="minutesFailure()"
      (closed)="minutesOpen.set(false)"
      (submitted)="generateMinutes($event)"
    ></app-sf-minutes-wizard>
  `,
})
export class PackageComponent implements OnInit {
  protected readonly store = inject(PackageStore);
  protected readonly workspace = inject(WorkspaceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly minutesFailure = signal<SfOutcome | null>(null);
  protected readonly minutesOpen = signal(false);

  /** One button per document; the minutes also have a wizard that collects the meeting data. */
  protected readonly singleKinds: readonly SfPdfaKind[] = SF_PDFA_KINDS;
  protected readonly color = validationColor;
  protected readonly size = sizeText;
  protected readonly sha = shortSha;

  protected readonly readOnly = computed(
    () => !this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE) || this.workspace.locked(),
  );
  protected readonly errorGroups = computed(() => groupIssues(this.store.report()?.errors ?? []));
  protected readonly warningGroups = computed(() =>
    groupIssues(this.store.report()?.warnings ?? []),
  );
  protected readonly verified = computed(() =>
    this.store.pdfaArtifacts().filter((artifact) => artifact.verification !== null),
  );
  protected readonly templates = computed(
    () => this.workspace.lookups()?.narrative_templates ?? [],
  );

  private get id(): string {
    return routeDossierId(this.route) ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id);
  }

  /** Text of a check by its id, the id itself when the dictionary does not know it. */
  protected checkLabel(id: string): string {
    const key = `statutoryFinancials.check.${id}`;
    const text = this.i18n.instant(key);
    return text === key ? id : text;
  }

  protected openMinutes(): void {
    this.minutesFailure.set(null);
    this.minutesOpen.set(true);
  }

  protected async exportXbrl(): Promise<void> {
    const outcome = await this.store.exportXbrl(this.id);
    this.finish(outcome, 'exported');
    await this.workspace.refresh();
  }

  protected async generate(payload: SfPdfaPayload): Promise<void> {
    const outcome = await this.store.generatePdfa(this.id, payload);
    this.finish(outcome, 'pdfaGenerated');
  }

  protected async generateMinutes(payload: SfPdfaPayload): Promise<void> {
    const outcome = await this.store.generatePdfa(this.id, payload);
    this.minutesFailure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.minutesOpen.set(false);
      this.message.success(this.i18n.instant('statutoryFinancials.message.pdfaGenerated'));
    }
  }

  protected async verify(artifact: SfArtifact): Promise<void> {
    const outcome = await this.store.verify(this.id, artifact.id);
    this.finish(outcome, 'verified');
  }

  protected async download(artifact: SfArtifact): Promise<void> {
    const { outcome, blob } = await this.store.download(this.id, artifact.id);
    this.failure.set(outcome.ok ? null : outcome);
    if (blob) {
      downloadBlob(blob, artifact.file_name);
    }
  }

  private finish(outcome: SfOutcome, done: string): void {
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant(`statutoryFinancials.message.${done}`));
    }
  }
}
