import { Component, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TicketDetailDrawerComponent } from '../../field-service/components/ticket-detail-drawer/ticket-detail-drawer.component';
import { SlaDashboardComponent } from './sla-dashboard.component';

/** `/helpdesk/sla`: tickets at risk of breaching an SLA and the SLA metrics, with the ticket drawer one click away. */
@Component({
  selector: 'app-helpdesk-sla-page',
  imports: [
    NzCardModule,
    PageHeaderComponent,
    SlaDashboardComponent,
    TicketDetailDrawerComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'HELPDESK_SLA.TITLE' | translate"
      [subtitle]="'HELPDESK_SLA.SUBTITLE' | translate"
    />
    <nz-card>
      <app-sla-dashboard (openTicket)="open($event)" />
    </nz-card>
    <app-ticket-detail-drawer [ticketId]="ticketId()" [(open)]="drawerOpen" />
  `,
})
export class HelpdeskSlaPageComponent {
  protected readonly ticketId = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);

  protected open(id: string): void {
    this.ticketId.set(id);
    this.drawerOpen.set(true);
  }
}
