import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { isBackendApiRequest } from '../auth/csrf.utils';

const MAX_TAGS = 200;

/** The ETag of each record URL the user has read, kept to send it back as `If-Match` when the record is changed. */
@Injectable({ providedIn: 'root' })
export class EntityTagStore {
  private readonly tags = new Map<string, string>();

  get(url: string): string | undefined {
    return this.tags.get(url);
  }

  set(url: string, tag: string): void {
    this.tags.delete(url);
    this.tags.set(url, tag);
    if (this.tags.size > MAX_TAGS) {
      const oldest = this.tags.keys().next().value;
      if (oldest !== undefined) {
        this.tags.delete(oldest);
      }
    }
  }

  delete(url: string): void {
    this.tags.delete(url);
  }

  /** Forgets the tags of the records an action URL belongs to (POST /sales/invoices/1/issue changes /sales/invoices/1). */
  forgetParentsOf(url: string): void {
    for (const key of [...this.tags.keys()]) {
      if (url.startsWith(key + '/')) {
        this.tags.delete(key);
      }
    }
  }
}

/** The record URL without query string or fragment, the key of the stored tag. */
export function recordKey(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Optimistic locking. The API sends an `ETag` with contacts, invoices, quotes and products: this interceptor remembers
 * it for the URL of the record (from a GET or the response of a change) and sends it as `If-Match` with the next PUT,
 * PATCH or DELETE of that URL. When the record changed meanwhile the API answers 412, which `errorInterceptor` shows as
 * an edit conflict; the stored tag is dropped so the next read fetches the current one.
 */
export const optimisticLockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  const store = inject(EntityTagStore);
  const key = recordKey(req.url);
  const changes = req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
  const known = changes ? store.get(key) : undefined;
  const outgoing = known !== undefined && !req.headers.has('If-Match') ? req.clone({ setHeaders: { 'If-Match': known } }) : req;

  return next(outgoing).pipe(
    tap({
      next: (event: HttpEvent<unknown>) => {
        if (!(event instanceof HttpResponse)) {
          return;
        }
        const tag = event.headers.get('ETag');
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          store.forgetParentsOf(key);
        }
        if (req.method === 'DELETE') {
          store.delete(key);
        } else if (tag !== null && (req.method === 'GET' || changes)) {
          store.set(key, tag);
        }
      },
      error: (err: unknown) => {
        if (changes && (err as { status?: number })?.status === 412) {
          store.delete(key);
        }
      },
    }),
  );
};
