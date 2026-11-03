import { deleteContact } from "../../api/contacts"
import { createResourcePage } from "../../types/resource-page"

/** A list of contacts, shared by the clients and the suppliers pages. */
export const ContactsPage = createResourcePage({
  remove: deleteContact,
  confirmDeleteKey: "CRM.CLIENTS.ACTIONS.CONFIRM_DELETE",
  deletedKey: "CRM.CLIENTS.MESSAGES.DELETED",
})
