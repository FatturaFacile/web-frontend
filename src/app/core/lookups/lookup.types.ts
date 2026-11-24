export interface LookupItemDto {
  id: string;
  code: string;
  label: string;
  short_label: string | null;
  metadata: Record<string, unknown> | null;
  is_default: boolean;
}

export interface LookupApiResponse {
  category: string;
  locale: string;
  data: LookupItemDto[];
}

export interface SaveLookupTranslationPayload {
  lookup_item_id: string;
  locale: string;
  label: string;
  short_label?: string | null;
  description?: string | null;
  tenant_id?: string | null;
}
