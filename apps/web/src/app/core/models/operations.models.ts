export type AppRole = 'supervisor' | 'coordinator' | 'technician';
export type WorkOrderStatus = 'pending' | 'en_route' | 'in_progress' | 'completed' | 'suspended';

export interface UserProfile {
  id: string;
  full_name: string;
  role: AppRole;
  active: boolean;
}

export interface WorkOrderSummary {
  id: string;
  code: string;
  customer_name: string | null;
  address: string;
  status: WorkOrderStatus;
  priority: number;
  scheduled_for: string;
  assigned_team_id: string | null;
}

export type WorkOrderType = 'technical_assistance' | 'new_installation' | 'service_transfer' | 'network_maintenance';

export interface WorkOrderImportRow {
  sourceRow: number;
  code: string;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string;
  taskType: WorkOrderType;
  priority: number;
  scheduledFor: string;
  zoneCode: string | null;
  nodeCode: string | null;
  boxCode: string | null;
}

export interface ImportRowError {
  sourceRow: number;
  code: string | null;
  errors: string[];
}

export interface WorkOrderImportResult {
  valid: WorkOrderImportRow[];
  invalid: ImportRowError[];
  headers: string[];
}
