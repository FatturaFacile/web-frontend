import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink, NzButtonModule, NzCardModule, NzIconModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Benvenuto in Fattura Facile"
      subtitle="La tua piattaforma per la gestione semplice di fatture e ordini"
    />

    <nz-card nzTitle="Accesso Rapido">
      <p>Gestisci i tuoi ordini e monitora il fatturato in tempo reale.</p>
      <a nz-button nzType="primary" routerLink="/orders">
        <nz-icon nzType="shopping-cart" />
        Vai a Storico Ordini
      </a>
    </nz-card>
  `,
  styles: `
    p {
      margin-bottom: 16px;
    }
  `,
})
export class WelcomeComponent {}
