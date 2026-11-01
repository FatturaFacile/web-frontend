export interface ProductionOrder {
  id?: string;
  num: string;
  product: string;
  qty: string;
  line: string;
  progress: string;
  qa: string;
  status?: string;
}

export interface BillOfMaterial {
  id: string;
  item_code: string;
  description: string;
  revision: string;
  components: Array<{
    item_id: string;
    quantity: number;
    unit: string;
  }>;
}

export interface TrackProductionStagePayload {
  actual_hours: number;
  status: 'pending' | 'running' | 'done';
}
