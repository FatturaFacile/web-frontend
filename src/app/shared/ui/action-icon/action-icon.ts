/** Semantic actions that are rendered as an icon (with a translated tooltip) instead of a text. */
export type ActionIconName =
  | 'save'
  | 'cancel'
  | 'close'
  | 'delete'
  | 'add'
  | 'create'
  | 'confirm'
  | 'edit';

interface ActionIconDefinition {
  /** Font Awesome classes of the icon. */
  readonly icon: string;
  /** Translation key of the tooltip and of the accessible label. */
  readonly labelKey: string;
}

export const ACTION_ICONS: Readonly<Record<ActionIconName, ActionIconDefinition>> = {
  save: { icon: 'fa-solid fa-floppy-disk', labelKey: 'COMMON.SAVE' },
  cancel: { icon: 'fa-solid fa-x', labelKey: 'COMMON.CANCEL' },
  close: { icon: 'fa-solid fa-x', labelKey: 'COMMON.CLOSE' },
  delete: { icon: 'fa-solid fa-trash', labelKey: 'COMMON.DELETE' },
  add: { icon: 'fa-solid fa-plus', labelKey: 'COMMON.ADD' },
  create: { icon: 'fa-solid fa-plus', labelKey: 'common.actions.create' },
  confirm: { icon: 'fa-solid fa-check', labelKey: 'common.actions.confirm' },
  edit: { icon: 'fa-solid fa-pen', labelKey: 'common.actions.edit' },
};
