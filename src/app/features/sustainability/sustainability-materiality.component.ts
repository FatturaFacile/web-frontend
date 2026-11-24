import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESG_ESRS_CODES,
  EsgMaterialityAssessment,
  EsgMaterialityTopicRequest,
  EsgMaterialityType,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

const TYPE_COLORS: Readonly<Record<EsgMaterialityType, string>> = {
  both: 'red',
  impact: 'orange',
  financial: 'blue',
  none: 'default',
};

/** Double materiality assessments: topics scored on impact and financial materiality against a threshold. */
@Component({
  selector: 'app-sustainability-materiality',
  styleUrl: './sustainability.scss',
  imports: [
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.MATERIALITY_TITLE' | translate" [subtitle]="'SUSTAINABILITY.MATERIALITY_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    @for (assessment of assessments(); track assessment.id) {
      <nz-card class="main-card" [nzTitle]="assessment.name" [nzExtra]="extra">
        <ng-template #extra>
          <nz-tag [nzColor]="assessment.status === 'approved' ? 'green' : 'default'">{{ ('SUSTAINABILITY.MATERIALITY_' + assessment.status.toUpperCase()) | translate }}</nz-tag>
          @if (assessment.status === 'draft') {
            <button nz-button nzType="primary" nz-popconfirm [nzPopconfirmTitle]="'SUSTAINABILITY.APPROVE_CONFIRM' | translate" (nzOnConfirm)="approve(assessment)">
              {{ 'SUSTAINABILITY.APPROVE' | translate }}
            </button>
          }
        </ng-template>
        <p class="muted">
          {{ 'SUSTAINABILITY.THRESHOLD' | translate }}: {{ assessment.threshold }} | {{ 'SUSTAINABILITY.MATERIAL_TOPICS' | translate }}: {{ assessment.material_topics_count }} / {{ assessment.topics.length }}
        </p>
        <nz-table #table [nzData]="assessment.topics" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'SUSTAINABILITY.ESRS_CODE' | translate }}</th>
              <th>{{ 'SUSTAINABILITY.TOPIC' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.IMPACT_SCORE' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.FINANCIAL_SCORE' | translate }}</th>
              <th>{{ 'SUSTAINABILITY.MATERIALITY' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (topic of table.data; track topic.id) {
              <tr>
                <td>{{ topic.esrs_code }}</td>
                <td>{{ topic.name }}</td>
                <td class="num">{{ topic.impact_score }}</td>
                <td class="num">{{ topic.financial_score }}</td>
                <td><nz-tag [nzColor]="typeColor(topic.materiality_type)">{{ ('SUSTAINABILITY.MATERIALITY_TYPE_' + topic.materiality_type.toUpperCase()) | translate }}</nz-tag></td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @empty {
      @if (!loading()) {
        <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_ASSESSMENTS' | translate"></nz-empty>
      }
    }

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="'SUSTAINABILITY.NEW_ASSESSMENT' | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="860px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.THRESHOLD' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'SUSTAINABILITY.THRESHOLD_HINT' | translate"><input nz-input type="number" min="0.5" max="5" step="0.5" formControlName="threshold" /></nz-form-control>
            </nz-form-item>
          </div>
          <h4>{{ 'SUSTAINABILITY.TOPICS' | translate }}</h4>
          <div formArrayName="topics">
            @for (topic of topics.controls; track topic; let index = $index) {
              <div class="topic-row" [formGroupName]="index">
                <nz-select formControlName="esrs_code">
                  @for (code of esrsCodes; track code) {
                    <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
                  }
                </nz-select>
                <input nz-input formControlName="name" [placeholder]="'SUSTAINABILITY.TOPIC' | translate" />
                <input nz-input type="number" min="0" max="5" step="0.5" formControlName="impact_score" [placeholder]="'SUSTAINABILITY.IMPACT_SCORE' | translate" />
                <input nz-input type="number" min="0" max="5" step="0.5" formControlName="financial_score" [placeholder]="'SUSTAINABILITY.FINANCIAL_SCORE' | translate" />
                <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" (click)="removeTopic(index)"></button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addTopic()">{{ 'SUSTAINABILITY.ADD_TOPIC' | translate }}</button>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityMaterialityComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly esrsCodes = ESG_ESRS_CODES;
  readonly assessments = signal<EsgMaterialityAssessment[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    threshold: ['3', [Validators.min(0.5), Validators.max(5)]],
    topics: this.fb.array<FormGroup>([]),
  });

  get topics(): FormArray<FormGroup> {
    return this.form.controls.topics;
  }

  ngOnInit(): void {
    this.load();
  }

  typeColor(type: EsgMaterialityType): string {
    return TYPE_COLORS[type];
  }

  load(): void {
    this.loading.set(true);
    this.api.getMaterialityAssessments().subscribe({
      next: (response) => {
        this.assessments.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.form.reset({ name: '', threshold: '3' });
    this.topics.clear();
    this.addTopic();
    this.modalVisible.set(true);
  }

  addTopic(): void {
    this.topics.push(
      this.fb.group({
        esrs_code: ['E1', [Validators.required]],
        name: ['', [Validators.required, Validators.maxLength(190)]],
        impact_score: ['', [Validators.required, Validators.min(0), Validators.max(5)]],
        financial_score: ['', [Validators.required, Validators.min(0), Validators.max(5)]],
      }),
    );
  }

  removeTopic(index: number): void {
    this.topics.removeAt(index);
  }

  save(): void {
    const value = this.form.getRawValue();
    const topics: EsgMaterialityTopicRequest[] = (value.topics as Record<string, unknown>[]).map((topic) => ({
      esrs_code: String(topic['esrs_code']),
      name: String(topic['name']),
      impact_score: String(topic['impact_score']),
      financial_score: String(topic['financial_score']),
    }));

    this.api.createMaterialityAssessment({ name: value.name, threshold: String(value.threshold), topics }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ASSESSMENT_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  approve(assessment: EsgMaterialityAssessment): void {
    this.api.approveMaterialityAssessment(assessment.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ASSESSMENT_APPROVED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
