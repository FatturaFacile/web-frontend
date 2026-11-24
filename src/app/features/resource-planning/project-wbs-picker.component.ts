import { Component, inject, input, model, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService, ProjectResource } from '@core';
import { TranslatePipe } from '@shared';
import { ProjectEvmApiService } from '../projects/evm/project-evm-api.service';
import { WbsNode } from '../projects/evm/project-evm.models';

export interface WbsOption {
  id: string;
  label: string;
}

/** Depth-first list of the WBS tree, each node labelled with its code and title. */
export function flattenWbs(nodes: readonly WbsNode[]): WbsOption[] {
  return nodes.flatMap((node) => [
    { id: node.wbs_node_id, label: `${node.wbs_code} · ${node.title}` },
    ...flattenWbs(node.children ?? []),
  ]);
}

/** Project and optional WBS node of a booking: the WBS tree is read when a project is chosen. */
@Component({
  selector: 'app-project-wbs-picker',
  imports: [FormsModule, TranslatePipe, NzFormModule, NzSelectModule],
  template: `
    <nz-form-item>
      <nz-form-label [nzRequired]="projectRequired()" [nzFor]="idPrefix() + '-project'">{{
        'resourcePlanning.project' | translate
      }}</nz-form-label>
      <nz-form-control>
        <nz-select
          [nzId]="idPrefix() + '-project'"
          nzShowSearch
          nzAllowClear
          [nzPlaceHolder]="'resourcePlanning.projectPlaceholder' | translate"
          [ngModel]="projectId()"
          (ngModelChange)="selectProject($event)"
        >
          @for (project of projects(); track project.id) {
            <nz-option
              [nzValue]="project.id"
              [nzLabel]="project.project_number + ' · ' + project.name"
            ></nz-option>
          }
        </nz-select>
      </nz-form-control>
    </nz-form-item>
    @if (projectId()) {
      <nz-form-item>
        <nz-form-label [nzFor]="idPrefix() + '-wbs'">{{
          'resourcePlanning.wbs' | translate
        }}</nz-form-label>
        <nz-form-control>
          <nz-select
            [nzId]="idPrefix() + '-wbs'"
            nzShowSearch
            nzAllowClear
            [nzLoading]="loadingWbs()"
            [nzPlaceHolder]="'resourcePlanning.wbsPlaceholder' | translate"
            [ngModel]="wbsNodeId()"
            (ngModelChange)="wbsNodeId.set($event ?? null)"
          >
            @for (node of wbsOptions(); track node.id) {
              <nz-option [nzValue]="node.id" [nzLabel]="node.label"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
    }
  `,
})
export class ProjectWbsPickerComponent implements OnInit {
  private readonly projectApi = inject(ProjectApiService);
  private readonly evmApi = inject(ProjectEvmApiService);

  readonly projectId = model<string | null>(null);
  readonly wbsNodeId = model<string | null>(null);
  readonly projectRequired = input(false);
  readonly idPrefix = input('rp-picker');

  readonly projects = signal<ProjectResource[]>([]);
  readonly wbsOptions = signal<WbsOption[]>([]);
  readonly loadingWbs = signal(false);

  ngOnInit(): void {
    void this.loadProjects();
    if (this.projectId()) {
      void this.loadWbs(this.projectId() as string);
    }
  }

  async selectProject(projectId: string | null): Promise<void> {
    this.projectId.set(projectId ?? null);
    this.wbsNodeId.set(null);
    this.wbsOptions.set([]);
    if (projectId) {
      await this.loadWbs(projectId);
    }
  }

  private async loadProjects(): Promise<void> {
    const response = await firstValueFrom(this.projectApi.getProjects({ per_page: 100 })).catch(
      () => null,
    );
    this.projects.set(response?.data ?? []);
  }

  private async loadWbs(projectId: string): Promise<void> {
    this.loadingWbs.set(true);
    const response = await firstValueFrom(this.evmApi.wbsBreakdown(projectId)).catch(() => null);
    // A project that was changed meanwhile keeps the list of the newest choice.
    if (this.projectId() === projectId) {
      this.wbsOptions.set(flattenWbs(response?.data.nodes ?? []));
    }
    this.loadingWbs.set(false);
  }
}
