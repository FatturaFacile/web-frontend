import {
  MrpDemandSourceType,
  MrpPegging,
  MrpPeggingDownstream,
  MrpPeggingNode,
  MrpPeggingUpstream,
  MrpProposalStatus,
  MrpProposalType,
} from './mrp.models';

export type PeggingDirection = 'upstream' | 'downstream';

/** What the inspector shows for a selected tree node. */
export interface PeggingNodeDetail {
  key: string;
  direction: PeggingDirection | 'group';
  /** Set when the node is a proposal (the focus proposal, a parent or a component). */
  proposalType: MrpProposalType | null;
  proposalStatus: MrpProposalStatus | null;
  itemCode: string | null;
  itemName: string | null;
  quantity: string | null;
  needByDate: string | null;
  /** Set when the node is a demand source (sales order line, MPS line, safety stock, allocation...). */
  sourceType: MrpDemandSourceType | null;
  sourceId: string | null;
  /** `true` for a root demand: an upstream entry that is not itself a proposal. */
  isRootDemand: boolean;
}

/** A node of the tree in the shape `nz-tree` reads (`key`, `title`, `children`, `isLeaf`) plus the detail the template renders. */
export interface PeggingTreeNode {
  key: string;
  title: string;
  isLeaf: boolean;
  expanded: boolean;
  selectable: boolean;
  detail: PeggingNodeDetail;
  children: PeggingTreeNode[];
}

export interface PeggingTree {
  nodes: PeggingTreeNode[];
  details: Record<string, PeggingNodeDetail>;
}

const blankDetail = (
  key: string,
  direction: PeggingNodeDetail['direction'],
): PeggingNodeDetail => ({
  key,
  direction,
  proposalType: null,
  proposalStatus: null,
  itemCode: null,
  itemName: null,
  quantity: null,
  needByDate: null,
  sourceType: null,
  sourceId: null,
  isRootDemand: false,
});

function proposalDetail(
  key: string,
  node: MrpPeggingNode,
  direction: PeggingDirection,
): PeggingNodeDetail {
  return {
    ...blankDetail(key, direction),
    proposalType: node.proposal_type,
    proposalStatus: node.status,
    itemCode: node.item_code,
    itemName: node.item_name,
    quantity: node.quantity,
    needByDate: node.need_by_date,
  };
}

/**
 * Builds the pegging tree of a proposal: the focus proposal at the top, then "upstream" (the demand it serves, down to the
 * root demands such as sales orders, MPS rows and safety stock) and "downstream" (the component proposals it generates).
 * The group nodes carry the keys `group-upstream` and `group-downstream`; their titles are filled in by the template.
 */
export function buildPeggingTree(pegging: MrpPegging): PeggingTree {
  const details: Record<string, PeggingNodeDetail> = {};
  const register = (detail: PeggingNodeDetail): PeggingNodeDetail => {
    details[detail.key] = detail;

    return detail;
  };

  const upstreamNode = (entry: MrpPeggingUpstream, path: string): PeggingTreeNode => {
    const key = `${path}/${entry.type}:${entry.id}`;
    const children = entry.upstream.map((child) => upstreamNode(child, key));
    const detail = register(
      entry.proposal === null
        ? {
            ...blankDetail(key, 'upstream'),
            quantity: entry.quantity,
            sourceType: entry.type,
            sourceId: entry.id,
            isRootDemand: true,
          }
        : {
            ...proposalDetail(key, entry.proposal, 'upstream'),
            quantity: entry.quantity,
            sourceType: entry.type,
            sourceId: entry.id,
          },
    );

    return {
      key,
      title: entry.proposal?.item_code ?? entry.id,
      isLeaf: children.length === 0,
      expanded: true,
      selectable: true,
      detail,
      children,
    };
  };

  const downstreamNode = (entry: MrpPeggingDownstream, path: string): PeggingTreeNode => {
    const key = `${path}/${entry.id}`;
    const children = entry.children.map((child) => downstreamNode(child, key));

    return {
      key,
      title: entry.item_code,
      isLeaf: children.length === 0,
      expanded: true,
      selectable: true,
      detail: register(proposalDetail(key, entry, 'downstream')),
      children,
    };
  };

  const group = (direction: PeggingDirection, children: PeggingTreeNode[]): PeggingTreeNode => {
    const key = `group-${direction}`;

    return {
      key,
      title: direction,
      isLeaf: children.length === 0,
      expanded: true,
      selectable: false,
      detail: register(blankDetail(key, 'group')),
      children,
    };
  };

  const rootKey = `proposal:${pegging.proposal.id}`;
  const upstream = group(
    'upstream',
    pegging.upstream.map((entry) => upstreamNode(entry, 'up')),
  );
  const downstream = group(
    'downstream',
    pegging.downstream.map((entry) => downstreamNode(entry, 'down')),
  );
  const root: PeggingTreeNode = {
    key: rootKey,
    title: pegging.proposal.item_code,
    isLeaf: false,
    expanded: true,
    selectable: true,
    detail: register(proposalDetail(rootKey, pegging.proposal, 'downstream')),
    children: [upstream, downstream],
  };

  return { nodes: [root], details };
}

/** The leaves of the upstream branch: every demand the proposal can be traced back to. */
export function rootDemandNodes(tree: PeggingTree): PeggingNodeDetail[] {
  return Object.values(tree.details).filter((detail) => detail.isRootDemand);
}
