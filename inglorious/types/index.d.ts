import "./vite-end"

import type { I18nEntity, Message } from "@inglorious/i18n"
import type { BaseEntity, EntitiesState, EntityType } from "@inglorious/store"
import type { AsyncEvents } from "@inglorious/store/async"
import type { ComboboxOption, ComboboxProps } from "@inglorious/ui/combobox"
import type { DataGridProps } from "@inglorious/ui/data-grid"
import type { Api, TemplateResult } from "@inglorious/web"
import type { FormEntity } from "@inglorious/web/form"
import type { RouteChangePayload, RouterEntity } from "@inglorious/web/router"
import type { MediaQueryEntity } from "@inglorious/web/sensors/media-query"

import type { HttpError } from "../src/api/http"
import type { LedgerEntry } from "../src/models/accounting"
import type { AlertResource, AlertSeverity } from "../src/models/alerts"
import type { TireRecord } from "../src/models/automotive"
import type { ContactResource, ContactType } from "../src/models/contact"
import type { KpiSummary } from "../src/models/dashboard"
import type { ExpenseResource, ExpenseStatus } from "../src/models/expenses"
import type { ProductItem } from "../src/models/inventory"
import type {
  InvoiceConfirmedAction,
  InvoiceResource,
  InvoiceType,
  Jurisdiction,
} from "../src/models/invoice"
import type { Order } from "../src/models/order"
import type { PurchaseOrder } from "../src/models/procurement"
import type { QrBill } from "../src/models/qr-bill"
import type { SystemBackup } from "../src/models/system"
import type {
  AttendanceRecord,
  TimeAttendanceData,
} from "../src/models/time-attendance"
import type {
  BankTransactionResource,
  ImportFormat,
} from "../src/models/treasury"
import type { UserProfile } from "../src/models/user"

export interface AppRouterEntity extends RouterEntity {
  type: "Router"
}

export interface AppI18nEntity extends I18nEntity {
  type: "I18n"
}

/** Who is signed in. `checking` until the backend has answered at startup. */
export interface SessionEntity extends BaseEntity {
  type: "Session"
  status: "checking" | "ready"
  user: UserProfile | null
}

/** Broadcast as `sessionChange` whenever the session is learned or changes. */
export interface SessionChangePayload {
  isKnown: boolean
  isSignedIn: boolean
}

/** What a guarded page knows of the session, kept current by `sessionChange`. */
export interface GuardedFields {
  isSessionKnown?: boolean
  isSignedIn?: boolean
}

export type ThemePreference = "light" | "dark" | "system"

export interface ShellEntity extends BaseEntity {
  type: "Shell"
  isSidebarCollapsed: boolean
  themePreference: ThemePreference
  /** The sidebar groups unfolded, by label. */
  expandedGroups: string[]
}

/** Whether the system asks for dark colors, kept current by the media query sensor. */
export interface PrefersDarkEntity
  extends BaseEntity, Omit<MediaQueryEntity, "id"> {
  type: "MediaQuery"
}

export interface ToastEntity extends BaseEntity {
  type: "Toast"
  isOpen: boolean
  message: Message | null
  showCount: number
}

export interface RedirectEntity extends BaseEntity {
  type: "Redirect"
  to: string
}

export interface NotPortedPageEntity extends BaseEntity, GuardedFields {
  type: "NotPortedPage"
}

export interface LoginValues {
  email: string
  password: string
  remember: boolean
}

export interface LoginPageEntity
  extends BaseEntity, FormEntity<LoginValues>, GuardedFields {
  type: "LoginPage"
  hasSubmitted: boolean
  isPasswordVisible: boolean
  failure: Message | null
}

/** A row of the contacts grid: the contact plus what its cells show. */
export interface ContactRow extends ContactResource {
  name: string
  contactPerson: string | null
  taxId: string
}

export interface ServerDataGridFields {
  /** Bumped by every fetch, so a late answer to an older one is ignored. */
  requestId: number
  isLoading: boolean
  failure: Message | null
}

export interface ContactsGridEntity
  extends BaseEntity, DataGridProps<ContactRow>, ServerDataGridFields {
  type: "ContactsGrid"
  /** The page whose rows these are: row actions are its events. */
  pageId: string
}

/** A page listing a resource in a grid, edited with a form: see createResourcePage. */
export interface ResourcePageEntity extends BaseEntity, GuardedFields {
  type:
    | "ClientsPage"
    | "SuppliersPage"
    | "InventoryPage"
    | "AlertsPage"
    | "PurchaseOrdersPage"
    | "ExpensesPage"
  gridId: string
  formId: string
  titleKey: string
  subtitleKey: string
  cardTitleKey: string | null
  pendingDelete: { id: string; name: string } | null
  isDeleting: boolean
}

export type ContactsPageEntity = ResourcePageEntity

/** What a form made with createResourceForm keeps beside its values. */
export interface ResourceFormFields {
  isOpen: boolean
  /** The row being edited, or null for a new one. */
  editingId: string | null
  /** The grid to load again once saved. */
  gridId: string | null
  hasSubmitted: boolean
  failure: Message | null
}

export interface ContactFormValues {
  type: ContactType
  country: string
  company_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  vat_number: string
  fiscal_code: string
  uid_number: string
  sdi_code: string
  pec: string
  iban: string
  qr_iban: string
  payment_terms_days: string
  address: {
    street: string
    house_number: string
    postal_code: string
    city: string
    state_canton: string
  }
}

export interface ContactFormEntity
  extends BaseEntity, FormEntity<ContactFormValues>, ResourceFormFields {
  type: "ContactForm"
}

/** A column of a list page: `title` is a translation key. */
export interface ListColumn {
  id: string
  title: string
  align?: "left" | "center" | "right"
}

export type ListPageTypeName =
  | "ConstructionPage"
  | "HrPage"
  | "FieldServicePage"
  | "ManufacturingPage"
  | "ProfessionalsPage"
  | "RentPage"
  | "RetailPage"

/** A page with one card listing what one endpoint returns. */
export interface ListPageEntity extends BaseEntity, GuardedFields {
  type: ListPageTypeName
  titleKey: string
  subtitleKey: string
  cardTitleKey: string
  columns: ListColumn[]
  rows: Record<string, unknown>[]
  isLoading: boolean
  failure: Message | null
}

/** The jurisdiction and currency the user works in. */
export interface WorkspaceEntity extends BaseEntity {
  type: "Workspace"
  jurisdiction: Jurisdiction
  currency: "EUR" | "CHF"
}

export interface DashboardPageEntity extends BaseEntity, GuardedFields {
  type: "DashboardPage"
  kpi: KpiSummary | null
  invoices: InvoiceResource[]
  isLoading: boolean
  failure: Message | null
}

export interface LoadedDataGridFields {
  isLoading: boolean
  failure: Message | null
}

/** A row of the orders grid: the order plus what its cells show. */
export interface OrderRow extends Order {
  itemsCount: number
}

export interface OrdersGridEntity
  extends BaseEntity, DataGridProps<OrderRow>, LoadedDataGridFields {
  type: "OrdersGrid"
}

export interface TireHotelGridEntity
  extends BaseEntity, DataGridProps<TireRecord>, LoadedDataGridFields {
  type: "TireHotelGrid"
}

/** A page whose content is one grid entity, loaded when the page opens. */
export interface GridPageEntity extends BaseEntity, GuardedFields {
  type: "OrdersPage" | "TireHotelPage"
  gridId: string
}

export type OrdersPageEntity = GridPageEntity
export type TireHotelPageEntity = GridPageEntity

export interface WelcomePageEntity extends BaseEntity, GuardedFields {
  type: "WelcomePage"
}

export interface AttendanceGridEntity
  extends BaseEntity, DataGridProps<AttendanceRecord> {
  type: "AttendanceGrid"
}

export interface TimeAttendancePageEntity extends BaseEntity, GuardedFields {
  type: "TimeAttendancePage"
  gridId: string
  /** Everything but the records, which the grid holds. */
  data: Omit<TimeAttendanceData, "records"> | null
  isLoading: boolean
  failure: Message | null
}

export type BackupAction = "download" | "restore" | "delete"

export interface BackupsGridEntity
  extends BaseEntity, DataGridProps<SystemBackup>, LoadedDataGridFields {
  type: "BackupsGrid"
  /** The page whose rows these are: row actions are its events. */
  pageId: string
}

export interface BackupsPageEntity extends BaseEntity, GuardedFields {
  type: "BackupsPage"
  gridId: string
  /** The restore or deletion waiting for confirmation. */
  pending: { action: "restore" | "delete"; id: string; filename: string } | null
  isWorking: boolean
  isCreating: boolean
  isUploadOpen: boolean
  isUploading: boolean
}

export interface InventoryGridEntity
  extends BaseEntity, DataGridProps<ProductItem>, ServerDataGridFields {
  type: "InventoryGrid"
  pageId: string
}

export type InventoryPageEntity = ResourcePageEntity

/** The product form holds text, as fields do; numbers are parsed on save. */
export interface ProductFormValues {
  sku: string
  name: string
  warehouse: string
  quantity: string
  unit_of_measure: string
  price: string
  hs_code: string
}

export interface ProductFormEntity
  extends BaseEntity, FormEntity<ProductFormValues>, ResourceFormFields {
  type: "ProductForm"
}

export interface AlertsGridEntity
  extends BaseEntity, DataGridProps<AlertResource>, ServerDataGridFields {
  type: "AlertsGrid"
  pageId: string
}

export interface AlertFormValues {
  title: string
  severity: AlertSeverity
  message: string
  is_active: boolean
}

export interface AlertFormEntity
  extends BaseEntity, FormEntity<AlertFormValues>, ResourceFormFields {
  type: "AlertForm"
}

export type SettingsTab = "org" | "branches" | "users" | "roles" | "audit"

export interface SettingsPageEntity extends BaseEntity, GuardedFields {
  type: "SettingsPage"
  tab: SettingsTab
  isSyncing: boolean
}

export interface TenantFormValues {
  name: string
  legal_name: string
  fiscal_code: string
  vat_number: string
  uid_number: string
  default_currency: string
  iban: string
  qr_iban: string
  sdi_code: string
  pec_email: string
}

export interface TenantFormEntity
  extends BaseEntity, FormEntity<TenantFormValues> {
  type: "TenantForm"
  isLoading: boolean
  isLoaded: boolean
  hasSubmitted: boolean
  failure: Message | null
}

/** The four read-only grids of the settings page. */
export interface SettingsGridEntity
  extends
    BaseEntity,
    DataGridProps<Record<string, unknown>>,
    LoadedDataGridFields {
  type: "BranchesGrid" | "UsersGrid" | "RolesGrid" | "AuditGrid"
}

export type TreasuryTab = "movements" | "accounts" | "statements"

export interface TreasuryPageEntity extends BaseEntity, GuardedFields {
  type: "TreasuryPage"
  tab: TreasuryTab
  isMatching: boolean
  isImportOpen: boolean
  importFormat: ImportFormat
  isImporting: boolean
}

export interface TransactionsGridEntity
  extends
    BaseEntity,
    DataGridProps<BankTransactionResource>,
    ServerDataGridFields {
  type: "TransactionsGrid"
}

/** The treasury's bank accounts and imported statements. */
export interface TreasuryGridEntity
  extends
    BaseEntity,
    DataGridProps<Record<string, unknown>>,
    LoadedDataGridFields {
  type: "BankAccountsGrid" | "StatementsGrid"
}

export type AccountingTab = "ledger" | "accounts" | "vat"

export interface AccountingPageEntity extends BaseEntity, GuardedFields {
  type: "AccountingPage"
  tab: AccountingTab
}

/** A ledger entry with its totals, which the grid shows. */
export interface LedgerRow extends LedgerEntry {
  total_debit: number
  total_credit: number
}

export interface LedgerGridEntity
  extends BaseEntity, DataGridProps<LedgerRow>, ServerDataGridFields {
  type: "LedgerGrid"
}

export interface AccountingGridEntity
  extends
    BaseEntity,
    DataGridProps<Record<string, unknown>>,
    LoadedDataGridFields {
  type: "AccountsGrid" | "VatGrid"
}

/** Fields hold text; amounts are parsed on save. */
export interface LedgerEntryFormValues {
  entry_number: string
  date: string
  description: string
  lines: {
    account_id: string
    debit: string
    credit: string
    description: string
  }[]
}

export interface LedgerEntryFormEntity
  extends BaseEntity, FormEntity<LedgerEntryFormValues>, ResourceFormFields {
  type: "LedgerEntryForm"
}

export interface PurchaseOrdersGridEntity
  extends BaseEntity, DataGridProps<PurchaseOrder>, ServerDataGridFields {
  type: "PurchaseOrdersGrid"
}

export interface PurchaseOrderFormValues {
  supplier_id: string
  order_date: string
  expected_delivery_date: string
  description: string
  quantity: string
  uom: string
  unit_price: string
}

export interface PurchaseOrderFormEntity
  extends BaseEntity, FormEntity<PurchaseOrderFormValues>, ResourceFormFields {
  type: "PurchaseOrderForm"
  /** The supplier registry, as select options. */
  suppliers: { value: string; label: string }[]
}

export interface ExpensesPageEntity extends ResourcePageEntity {
  type: "ExpensesPage"
  isExporting: boolean
}

export interface ExpensesGridEntity
  extends BaseEntity, DataGridProps<ExpenseResource>, ServerDataGridFields {
  type: "ExpensesGrid"
}

export interface ExpenseFormValues {
  date: string
  amount: string
  currency: "EUR" | "CHF"
  description: string
  merchant: string
  status: ExpenseStatus
}

export interface ExpenseFormEntity
  extends BaseEntity, FormEntity<ExpenseFormValues>, ResourceFormFields {
  type: "ExpenseForm"
}

export interface InvoicePendingAction {
  action: InvoiceConfirmedAction
  id: string
  number: string
}

export interface InvoicesPageEntity extends BaseEntity, GuardedFields {
  type: "InvoicesPage"
  gridId: string
  formId: string
  /** The action waiting for confirmation. */
  pending: InvoicePendingAction | null
  isWorking: boolean
  /** The invoice whose PDF, QR-bill or copy is being fetched. */
  busyId: string | null
}

export interface InvoicesGridEntity
  extends BaseEntity, DataGridProps<InvoiceResource>, ServerDataGridFields {
  type: "InvoicesGrid"
}

export interface InvoiceLineValues {
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
  discount_percentage: string
}

export interface InvoiceFormValues {
  contact_id: string
  invoice_type: InvoiceType
  invoice_number: string
  date: string
  due_date: string
  currency: "CHF" | "EUR"
  jurisdiction: Jurisdiction
  notes: string
  items: InvoiceLineValues[]
}

export interface InvoiceFormEntity
  extends BaseEntity, FormEntity<InvoiceFormValues>, ResourceFormFields {
  type: "InvoiceForm"
  /** The combobox the client is picked with. */
  pickerId: string
}

export interface ContactPickerEntity
  extends BaseEntity, Omit<ComboboxProps, "id" | "type"> {
  type: "ContactPicker"
  requestId: number
  /** The option chosen, kept listed whatever the search. */
  chosen: ComboboxOption | null
}

export interface QrBillPageEntity extends BaseEntity, GuardedFields {
  type: "QrBillPage"
  gridId: string
  /** The rounding calculator's amount, as typed. */
  rawAmount: string
}

export interface QrBillGridEntity
  extends BaseEntity, DataGridProps<QrBill>, LoadedDataGridFields {
  type: "QrBillGrid"
}

export type AppEntity =
  | AppRouterEntity
  | AppI18nEntity
  | SessionEntity
  | ShellEntity
  | ToastEntity
  | RedirectEntity
  | NotPortedPageEntity
  | LoginPageEntity
  | ContactsGridEntity
  | ResourcePageEntity
  | ContactFormEntity
  | ListPageEntity
  | WorkspaceEntity
  | DashboardPageEntity
  | OrdersGridEntity
  | TireHotelGridEntity
  | GridPageEntity
  | WelcomePageEntity
  | PrefersDarkEntity
  | AttendanceGridEntity
  | TimeAttendancePageEntity
  | BackupsGridEntity
  | BackupsPageEntity
  | InventoryGridEntity
  | ProductFormEntity
  | AlertsGridEntity
  | AlertFormEntity
  | SettingsPageEntity
  | TenantFormEntity
  | SettingsGridEntity
  | TreasuryPageEntity
  | TransactionsGridEntity
  | TreasuryGridEntity
  | AccountingPageEntity
  | LedgerGridEntity
  | AccountingGridEntity
  | LedgerEntryFormEntity
  | PurchaseOrdersGridEntity
  | PurchaseOrderFormEntity
  | ExpensesPageEntity
  | ExpensesGridEntity
  | ExpenseFormEntity
  | InvoicesPageEntity
  | InvoicesGridEntity
  | InvoiceFormEntity
  | ContactPickerEntity
  | QrBillPageEntity
  | QrBillGridEntity

export interface AppState extends EntitiesState<AppEntity> {
  router: AppRouterEntity
  i18n: AppI18nEntity
  session: SessionEntity
  shell: ShellEntity
  toast: ToastEntity
  root: RedirectEntity
  crm: RedirectEntity
  sales: RedirectEntity
  notPorted: NotPortedPageEntity
  login: LoginPageEntity
  clients: ContactsPageEntity
  clientsGrid: ContactsGridEntity
  suppliers: ContactsPageEntity
  suppliersGrid: ContactsGridEntity
  contactForm: ContactFormEntity
  construction: ListPageEntity
  hr: ListPageEntity
  fieldService: ListPageEntity
  manufacturing: ListPageEntity
  professionals: ListPageEntity
  rent: ListPageEntity
  retail: ListPageEntity
  workspace: WorkspaceEntity
  dashboard: DashboardPageEntity
  orders: OrdersPageEntity
  ordersGrid: OrdersGridEntity
  tireHotel: TireHotelPageEntity
  tireHotelGrid: TireHotelGridEntity
  welcome: WelcomePageEntity
  prefersDark: PrefersDarkEntity
  timeAttendance: TimeAttendancePageEntity
  attendanceGrid: AttendanceGridEntity
  backups: BackupsPageEntity
  backupsGrid: BackupsGridEntity
  inventory: InventoryPageEntity
  inventoryGrid: InventoryGridEntity
  productForm: ProductFormEntity
  alerts: ResourcePageEntity
  alertsGrid: AlertsGridEntity
  alertForm: AlertFormEntity
  settings: SettingsPageEntity
  tenantForm: TenantFormEntity
  branchesGrid: SettingsGridEntity
  usersGrid: SettingsGridEntity
  rolesGrid: SettingsGridEntity
  auditGrid: SettingsGridEntity
  treasury: TreasuryPageEntity
  transactionsGrid: TransactionsGridEntity
  bankAccountsGrid: TreasuryGridEntity
  statementsGrid: TreasuryGridEntity
  accounting: AccountingPageEntity
  ledgerGrid: LedgerGridEntity
  accountsGrid: AccountingGridEntity
  vatGrid: AccountingGridEntity
  ledgerEntryForm: LedgerEntryFormEntity
  purchaseOrders: ResourcePageEntity
  purchaseOrdersGrid: PurchaseOrdersGridEntity
  purchaseOrderForm: PurchaseOrderFormEntity
  expenses: ExpensesPageEntity
  expensesGrid: ExpensesGridEntity
  expenseForm: ExpenseFormEntity
  invoices: InvoicesPageEntity
  invoicesGrid: InvoicesGridEntity
  invoiceForm: InvoiceFormEntity
  invoiceContactPicker: ContactPickerEntity
  qrBill: QrBillPageEntity
  qrBillGrid: QrBillGridEntity
}

export type AppApi = Api<AppEntity, AppState>

export type { HttpError, RouteChangePayload }

// Each type's events and their payloads. Declare types with `type`, not
// `interface`: an interface does not fit the store's `types`.
export type SessionType = {
  init: (entity: SessionEntity, payload: void, api: AppApi) => void
  checkSuccess: (
    entity: SessionEntity,
    user: UserProfile | null,
    api: AppApi,
  ) => void
  signIn: (entity: SessionEntity, user: UserProfile, api: AppApi) => void
  signOut: (entity: SessionEntity, payload: void, api: AppApi) => void
  requestFail: (entity: SessionEntity, error: HttpError, api: AppApi) => void
} & AsyncEvents<"tenantSwitch", SessionEntity, string, UserProfile, AppApi>

export type ShellType = {
  create: (entity: ShellEntity) => void
  routeChange: (entity: ShellEntity, payload: RouteChangePayload) => void
  groupToggle: (entity: ShellEntity, label: string) => void
  sidebarToggle: (entity: ShellEntity) => void
  themeChange: (entity: ShellEntity, preference: ThemePreference) => void
  render: (entity: ShellEntity, api: AppApi) => TemplateResult
}

export type ToastType = {
  show: (entity: ToastEntity, message: Message, api: AppApi) => void
  expire: (entity: ToastEntity, showCount: number) => void
  close: (entity: ToastEntity) => void
  requestFail: (entity: ToastEntity, error: HttpError, api: AppApi) => void
  render: (entity: ToastEntity, api: AppApi) => TemplateResult | null
}

export type RedirectType = {
  routeChange: (
    entity: RedirectEntity,
    payload: RouteChangePayload,
    api: AppApi,
  ) => void
  render: () => TemplateResult | null
}

export type NotPortedPageType = {
  render: () => TemplateResult
}

export type ContactsPageType = {
  routeChange: (
    entity: ContactsPageEntity,
    payload: RouteChangePayload,
    api: AppApi,
  ) => void
  createOpen: (entity: ContactsPageEntity, payload: void, api: AppApi) => void
  editOpen: (entity: ContactsPageEntity, row: ContactRow, api: AppApi) => void
  deleteAsk: (entity: ContactsPageEntity, row: ContactRow) => void
  deleteCancel: (entity: ContactsPageEntity) => void
  render: (entity: ContactsPageEntity, api: AppApi) => TemplateResult
}

export type WorkspaceType = {
  jurisdictionChange: (
    entity: WorkspaceEntity,
    jurisdiction: Jurisdiction,
  ) => void
  currencyChange: (entity: WorkspaceEntity, currency: "EUR" | "CHF") => void
  render: (entity: WorkspaceEntity, api: AppApi) => TemplateResult
}

// A shorthand for a type: `{ ... } satisfies AppType<MessageEntity>` infers
// its handlers' parameters, but neither lists its events nor types payloads.
export type AppType<TEntity extends AppEntity> = EntityType<TEntity, AppApi>
