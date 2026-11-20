import { Routes } from '@angular/router';

export const OCR_INBOX_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: 'OCR_INBOX.TITLE', title: 'OCR_INBOX.TITLE' },
    loadComponent: () => import('./ocr-inbox-page.component').then((m) => m.OcrInboxPageComponent),
  },
];
