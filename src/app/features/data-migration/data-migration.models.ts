export type MigrationSourceSystem =
  | 'FattureInCloud'
  | 'DipendentiInCloud'
  | 'Bexio'
  | 'Abacus'
  | 'BananaAccounting'
  | 'DaneaEasyfatt'
  | 'TeamSystem'
  | 'Zucchetti'
  | 'Odoo'
  | 'FatturaPaXmlZipArchive'
  | 'GenericCsvXlsx';

export type MigrationTargetEntity =
  | 'ChartOfAccounts'
  | 'Customers'
  | 'Vendors'
  | 'Products'
  | 'Employees'
  | 'OpeningGlBalances'
  | 'OpenArApItems'
  | 'HistoricalInvoices';

export type MigrationJobStatus =
  | 'Uploaded'
  | 'Mapped'
  | 'DryRunValidated'
  | 'Executing'
  | 'Completed'
  | 'RolledBack'
  | 'Failed';

export interface ColumnMappingEntry {
  source_column: string | null;
  required: boolean;
  default_value: string | null;
  confidence: number;
}

export interface ValueTransformationsConfig {
  date_format?: string;
  decimal_separator?: string;
  thousand_separator?: string;
  currency_default?: string;
  debit_credit_sign_rule?: string;
  vat_code_map?: Record<string, string>;
  uom_map?: Record<string, string>;
}

export interface ConnectorMetadata {
  code: MigrationSourceSystem;
  name_key: string;
  description_key: string;
  jurisdiction: 'IT' | 'CH' | 'CROSS_BORDER';
  default_currency: string;
  supported_extensions: string[];
  default_entities: MigrationTargetEntity[];
  default_transformations: ValueTransformationsConfig;
}

export interface EntityFieldSchema {
  field: string;
  required: boolean;
  type: string;
  sample: string;
  label_key: string;
}

export interface EntitySchemaMetadata {
  code: MigrationTargetEntity;
  label_key: string;
  fields: EntityFieldSchema[];
}

export interface MigrationFieldMappingTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  source_system: MigrationSourceSystem;
  entity_type: MigrationTargetEntity;
  column_mappings_json: Record<string, ColumnMappingEntry>;
  value_transformations_json: ValueTransformationsConfig | null;
  is_system_preset: boolean;
  created_at?: string;
}

export interface MigrationDryRunSummary {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  error_count: number;
  entity_breakdown: Record<string, number>;
  fiscal_checks_failed: number;
  referential_checks_failed: number;
  gl_balance: {
    has_opening_balances: boolean;
    total_debit: string;
    total_credit: string;
    difference: string;
    is_balanced: boolean;
  };
  dry_run_passed: boolean;
}

export interface MigrationJob {
  id: string;
  tenant_id: string | null;
  legal_entity_id: string | null;
  created_by_user_id: string | null;
  source_system: MigrationSourceSystem;
  target_entities: MigrationTargetEntity[];
  status: MigrationJobStatus;
  dry_run_passed: boolean;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  source_file_path: string | null;
  source_metadata_json: {
    file_name?: string;
    extension?: string;
    headers?: string[];
    headers_by_entity?: Record<string, string[]>;
    sample?: Record<string, string>[];
    parser_metadata?: Record<string, unknown>;
    matched_template_id?: string | null;
    mappings_by_entity?: Record<string, Record<string, ColumnMappingEntry>>;
    value_transformations?: ValueTransformationsConfig;
  } | null;
  dry_run_summary_json: MigrationDryRunSummary | null;
  rollback_manifest_json: {
    created_records?: { entity: string; model: string; id: string }[];
  } | null;
  dry_run_at: string | null;
  completed_at: string | null;
  rolled_back_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MigrationValidationError {
  id: string;
  migration_job_id: string;
  row_index: number;
  source_record_identifier: string | null;
  entity_type: MigrationTargetEntity;
  field_name: string;
  raw_value: string | null;
  error_code: string;
  message_key: string;
  suggested_fix: string | null;
  is_resolved: boolean;
}

export interface MigrationStagingRow {
  id: string;
  migration_job_id: string;
  row_index: number;
  entity_type: MigrationTargetEntity;
  source_record_identifier: string | null;
  raw_payload_json: Record<string, unknown>;
  mapped_payload_json: Record<string, unknown> | null;
  is_valid: boolean;
  is_imported: boolean;
  imported_record_id: string | null;
}

export interface MigrationDryRunReport {
  job: MigrationJob;
  summary: MigrationDryRunSummary;
  errors: MigrationValidationError[];
  staging_rows: MigrationStagingRow[];
}

export interface DataMigrationMetadataResponse {
  connectors: ConnectorMetadata[];
  entities: EntitySchemaMetadata[];
  templates: MigrationFieldMappingTemplate[];
  supported_locales: string[];
}
