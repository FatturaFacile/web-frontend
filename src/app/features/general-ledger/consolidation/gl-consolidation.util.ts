import { ConsolidationGroup, ConsolidationRun } from '@core';

/** Name of an entity of the group, or its id when it is not (or no longer) a member. */
export function memberName(group: ConsolidationGroup | null | undefined, tenantId: string | null | undefined): string {
  if (!tenantId) {
    return '';
  }
  return group?.members?.find((member) => member.member_tenant_id === tenantId)?.name ?? tenantId;
}

/** Name of an entity from the member snapshot stored with a run. */
export function snapshotName(run: ConsolidationRun | null | undefined, tenantId: string | null | undefined): string {
  if (!tenantId) {
    return '';
  }
  return run?.members?.find((member) => member.tenant_id === tenantId)?.name ?? tenantId;
}

/** Empty strings and nulls of a form become `null`, numbers stay numbers (nullable API fields). */
export function nullable<T>(value: T | '' | null | undefined): T | null {
  return value === '' || value === undefined ? null : value;
}
