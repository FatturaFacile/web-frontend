import { Routes } from '@angular/router';
import { OcrInboxRealtimeService } from './ocr-inbox-realtime.service';

export const OCR_INBOX_ROUTES: Routes = [
  {
    path: '',
    providers: [OcrInboxRealtimeService],
    data: { breadcrumb: 'OCR_INBOX.TITLE', title: 'OCR_INBOX.TITLE' },
    loadComponent: () => import('./ocr-inbox-page.component').then((m) => m.OcrInboxPageComponent),
  },
];
