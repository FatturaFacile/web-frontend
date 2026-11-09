export type WorkspaceProvider = 'google' | 'microsoft';
export type WorkspaceScope = 'calendar' | 'mail';
export type WorkspaceItemKind = 'calendar_event' | 'email';

export interface WorkspaceConnectionResource {
  id: string;
  provider: WorkspaceProvider | string;
  scopes: (WorkspaceScope | string)[];
  consent_given_at: string;
  revoked_at?: string | null;
  last_synced_at?: string | null;
}

export interface AuthorizeWorkspaceRequest {
  consent: boolean;
  scopes: (WorkspaceScope | string)[];
}

export interface WorkspaceAuthorizeResponse {
  authorization_url: string;
}

export interface WorkspaceCallbackRequest {
  code: string;
  state: string;
}

export interface WorkspaceSyncResponse {
  items: number;
}

export interface WorkspaceItemResource {
  id: string;
  kind: WorkspaceItemKind | string;
  subject?: string | null;
  counterpart?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface WorkspaceItemQueryParams {
  kind?: WorkspaceItemKind | string;
  contact_id?: string;
  per_page?: number;
}
