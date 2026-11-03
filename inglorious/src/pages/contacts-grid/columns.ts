import type { Column } from "@inglorious/ui/data-grid"

/** The columns of a contacts grid. Titles are translation keys. */
export function contactColumns(): Column[] {
  return [
    {
      id: "name",
      title: "CRM.CLIENTS.COLUMNS.NAME",
      isSortable: true,
      width: "2fr",
    },
    { id: "type", title: "CRM.CLIENTS.COLUMNS.TYPE", width: 140 },
    { id: "taxId", title: "CRM.CLIENTS.COLUMNS.TAX_ID", width: "1fr" },
    { id: "email", title: "CRM.CLIENTS.COLUMNS.EMAIL", width: "1.5fr" },
    { id: "phone", title: "CRM.CLIENTS.COLUMNS.PHONE", width: 150 },
    { id: "country", title: "CRM.CLIENTS.COLUMNS.COUNTRY", width: 100 },
    { id: "actions", title: "CRM.CLIENTS.COLUMNS.ACTIONS", width: 110 },
  ]
}
