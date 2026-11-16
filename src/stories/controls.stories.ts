import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

const meta: Meta = {
  title: 'Foundations/Controls',
  decorators: [
    moduleMetadata({
      imports: [FormsModule, NzButtonModule, NzInputModule, NzCheckboxModule, NzSwitchModule],
    }),
  ],
};
export default meta;

export const Buttons: StoryObj = {
  render: () => ({
    template: `
      <div style="display:flex;gap:12px;align-items:center">
        <button nz-button nzType="primary">Salva</button>
        <button nz-button>Annulla</button>
        <button nz-button nzType="primary" nzDanger>Elimina</button>
        <button nz-button nzType="link">Dettagli</button>
        <button nz-button nzType="primary" disabled>Non disponibile</button>
      </div>`,
  }),
};

export const FormControls: StoryObj = {
  render: () => ({
    template: `
      <form style="display:grid;gap:12px;max-width:360px">
        <label for="sb-name">Ragione sociale</label>
        <input id="sb-name" nz-input placeholder="Es. Rossi S.r.l." />
        <label nz-checkbox>Applica ritenuta d'acconto</label>
        <label style="display:flex;gap:8px;align-items:center">
          <nz-switch aria-label="Invio automatico allo SDI" /> Invio automatico allo SDI
        </label>
      </form>`,
  }),
};
