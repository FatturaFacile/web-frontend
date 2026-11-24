import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import { JurisdictionZone, NodeCoordinates, SovereigntyScope } from './data-sovereignty.models';
import { DataSovereigntyStore } from './data-sovereignty.store';
import {
  downloadBlob,
  healthColor,
  healthKey,
  statusColor,
  statusKey,
  zoneColor,
  zoneKey,
} from './data-sovereignty.utils';
import { SovereignMapComponent } from './sovereign-map.component';
import { SovereigntyNavComponent } from './sovereignty-nav.component';

/**
 * The data sovereignty posture for the DPO and the CISO: the jurisdiction and compliance frameworks, the geo-sharding matrix of a
 * cross-border group (each legal entity on its own nodes), the data center map and the one-click signed certificate.
 */
@Component({
  selector: 'app-data-sovereignty-dashboard',
  imports: [
    DatePipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    SovereignMapComponent,
    SovereigntyNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'DATA_SOVEREIGNTY.TITLE' | translate"
      [subtitle]="'DATA_SOVEREIGNTY.SUBTITLE' | translate"
    ></app-page-header>
    <app-sovereignty-nav></app-sovereignty-nav>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.failed()) {
        <nz-alert
          nzType="error"
          data-testid="load-error"
          [nzMessage]="'DATA_SOVEREIGNTY.LOAD_ERROR' | translate"
        ></nz-alert>
      } @else if (store.scopes().length === 0 && !store.loading()) {
        <nz-empty
          data-testid="no-policy"
          [nzNotFoundContent]="'DATA_SOVEREIGNTY.NO_POLICY' | translate"
        ></nz-empty>
      } @else {
        @if (store.isLocked()) {
          <nz-alert
            nzType="error"
            nzShowIcon
            data-testid="locked-banner"
            [nzMessage]="'DATA_SOVEREIGNTY.LOCKED_BANNER' | translate"
          ></nz-alert>
        }

        <nz-card
          class="posture"
          data-testid="posture"
          [nzTitle]="'DATA_SOVEREIGNTY.POSTURE' | translate"
        >
          <div class="zones">
            @for (zone of zones(); track zone) {
              <nz-tag [nzColor]="zoneColor(zone)" [attr.data-testid]="'zone-' + zone">
                {{ zoneKey(zone) | translate }}
              </nz-tag>
            }
          </div>
          <div class="frameworks" data-testid="frameworks">
            @for (framework of frameworks(); track framework) {
              <nz-tag nzColor="geekblue">{{ framework }}</nz-tag>
            }
          </div>
          <div class="posture-actions">
            <button
              nz-button
              nzType="primary"
              data-testid="download-pdf"
              [nzLoading]="store.busy()"
              [disabled]="store.busy()"
              (click)="downloadCertificate()"
            >
              {{ 'DATA_SOVEREIGNTY.DOWNLOAD_PDF' | translate }}
            </button>
            <button
              nz-button
              data-testid="download-json"
              [disabled]="store.busy()"
              (click)="downloadBundle()"
            >
              {{ 'DATA_SOVEREIGNTY.DOWNLOAD_JSON' | translate }}
            </button>
            @if (store.attestation(); as issued) {
              <span class="certificate" data-testid="certificate-number">
                {{ issued.attestation.certificate_number }} ·
                {{ 'DATA_SOVEREIGNTY.VALID_UNTIL' | translate }}
                {{ issued.attestation.valid_until | date: 'mediumDate' }}
              </span>
            }
          </div>
        </nz-card>

        <nz-card [nzTitle]="'DATA_SOVEREIGNTY.MATRIX' | translate" data-testid="matrix">
          <nz-table #matrix [nzData]="store.scopes()" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'DATA_SOVEREIGNTY.COL_ENTITY' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.COL_ZONE' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.SERVICE_POSTGRES_PRIMARY' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.SERVICE_S3_DMS' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.SERVICE_PGVECTOR' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.SERVICE_AI_INFERENCE' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.SERVICE_BACKUP_VAULT' | translate }}</th>
                <th>{{ 'DATA_SOVEREIGNTY.COL_CONSOLIDATION' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (scope of matrix.data; track scope.policy_id) {
                <tr [attr.data-testid]="'scope-' + (scope.legal_entity_id ?? 'default')">
                  <td>
                    @if (scope.legal_entity_name) {
                      {{ scope.legal_entity_name }}
                      <small>({{ scope.legal_entity_country }})</small>
                    } @else {
                      {{ 'DATA_SOVEREIGNTY.TENANT_DEFAULT' | translate }}
                    }
                  </td>
                  <td>
                    <nz-tag [nzColor]="zoneColor(scope.jurisdiction_zone)">{{
                      zoneKey(scope.jurisdiction_zone) | translate
                    }}</nz-tag>
                  </td>
                  <td>
                    {{ place(scope.nodes.postgres_primary) }}<br /><small>{{
                      replicas(scope)
                    }}</small>
                  </td>
                  <td>{{ place(scope.nodes.s3_dms) }}</td>
                  <td>{{ place(scope.nodes.pgvector) }}</td>
                  <td>{{ place(scope.nodes.ai_inference) }}</td>
                  <td>{{ place(scope.nodes.backup_vault) }}</td>
                  <td>
                    @if (scope.aggregated_non_pii_consolidation) {
                      <nz-tag nzColor="success">{{
                        'DATA_SOVEREIGNTY.AGGREGATES_ONLY' | translate
                      }}</nz-tag>
                    } @else {
                      <nz-tag nzColor="default">{{
                        'DATA_SOVEREIGNTY.NO_CONSOLIDATION' | translate
                      }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card [nzTitle]="'DATA_SOVEREIGNTY.MAP' | translate">
          <app-sovereign-map [sites]="store.sites()"></app-sovereign-map>
        </nz-card>

        @if (store.envelopes().length > 0) {
          <nz-card [nzTitle]="'DATA_SOVEREIGNTY.KEY_HEALTH' | translate" data-testid="key-health">
            @for (envelope of store.envelopes(); track envelope.id) {
              <p>
                <nz-tag [nzColor]="statusColor(envelope.status)">{{
                  statusKey(envelope.status) | translate
                }}</nz-tag>
                <nz-tag [nzColor]="healthColor(envelope.kms_health)">{{
                  healthKey(envelope.kms_health) | translate
                }}</nz-tag>
                {{ envelope.mode }} · {{ envelope.key_version }}
              </p>
            }
          </nz-card>
        }
      }
    </nz-spin>
  `,
  styles: `
    .posture,
    nz-card {
      margin-bottom: 16px;
    }
    .zones,
    .frameworks,
    .posture-actions {
      margin-bottom: 12px;
    }
    .posture-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
  `,
})
export class DataSovereigntyDashboardComponent implements OnInit {
  protected readonly store = inject(DataSovereigntyStore);
  private readonly api = inject(DataSovereigntyApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly zoneColor = zoneColor;
  protected readonly zoneKey = zoneKey;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;
  protected readonly healthColor = healthColor;
  protected readonly healthKey = healthKey;

  protected readonly zones = computed<JurisdictionZone[]>(() => [
    ...new Set(this.store.scopes().map((scope) => scope.jurisdiction_zone)),
  ]);
  protected readonly frameworks = computed<string[]>(() => [
    ...new Set(this.store.scopes().flatMap((scope) => scope.compliance_frameworks)),
  ]);

  ngOnInit(): void {
    this.store.loadDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected place(node: NodeCoordinates): string {
    return `${node.node_code} · ${node.city} (${node.canton_or_region})`;
  }

  protected replicas(scope: SovereigntyScope): string {
    return scope.nodes.postgres_replicas.map((node) => node.node_code).join(', ');
  }

  /** Issues the signed certificate for the primary scope and downloads its PDF in the language of the interface. */
  protected downloadCertificate(): void {
    this.issue((id, entityId) => {
      this.api
        .attestationPdf(id, this.translate.currentLanguage())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (pdf) => downloadBlob(pdf, `${entityId ?? 'sovereignty'}-certificate.pdf`),
          error: () =>
            this.message.error(this.translate.translate('DATA_SOVEREIGNTY.DOWNLOAD_ERROR')),
        });
    });
  }

  /** The verifiable JSON bundle: payload, hash, signature and the platform public key. */
  protected downloadBundle(): void {
    this.issue(() => {
      const issued = this.store.attestation();

      if (issued !== null) {
        downloadBlob(
          new Blob([JSON.stringify(issued.bundle, null, 2)], { type: 'application/json' }),
          `${issued.attestation.certificate_number}.json`,
        );
      }
    });
  }

  private issue(then: (attestationId: string, entityId: string | null) => void): void {
    const entityId = this.store.primaryScope()?.legal_entity_id ?? null;

    this.store
      .generateAttestation(entityId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (issued) => then(issued.attestation.id, entityId),
        error: () =>
          this.message.error(this.translate.translate('DATA_SOVEREIGNTY.CERTIFICATE_ERROR')),
      });
  }
}
