import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageHeaderComponent, ResourcePanelComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map } from 'rxjs';
import { MEMBER_FILE_PANELS } from '../pages/members.page';

/** File of one member: guardians, authorizations, documents and medical certificates. */
@Component({
  selector: 'app-association-member-file',
  imports: [NzButtonModule, NzTabsModule, PageHeaderComponent, ResourcePanelComponent, RouterLink, TranslatePipe],
  template: `
    <app-page-header [title]="'RES.PAGE.ASSOC_MEMBER_FILE' | translate" />
    <a nz-button nzType="link" routerLink="/associations/memberships">{{ 'RES.A.back_to_members' | translate }}</a>
    <nz-tabs nzLazy>
      @for (panel of panels; track panel.id) {
        <nz-tab [nzTitle]="panel.titleKey | translate">
          <ng-template nz-tab>
            <app-resource-panel [config]="panel" [context]="context()" />
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>
  `,
})
export class AssociationMemberFileComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly panels = MEMBER_FILE_PANELS;
  private readonly memberId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), { initialValue: '' });
  protected readonly context = computed(() => ({ id: this.memberId() }));
}
