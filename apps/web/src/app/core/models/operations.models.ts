export type AppRole = 'supervisor' | 'coordinator' | 'technician';
export type WorkOrderStatus = 'pending' | 'en_route' | 'in_progress' | 'completed' | 'suspended';

export interface UserProfile {
  id: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  email?: string;
  phone?: string | null;
  created_at?: string;
}

export type AvailabilityStatus = 'available' | 'unavailable' | 'on_service';

export interface TechnicianRecord {
  id: string;
  profile_id: string | null;
  document_number: string | null;
  phone: string | null;
  availability: AvailabilityStatus;
  active: boolean;
  profile?: Pick<UserProfile, 'full_name' | 'email'> | null;
}

export interface VehicleRecord {
  id: string;
  plate: string;
  model: string | null;
  vehicle_type: string | null;
  status: AvailabilityStatus;
  active: boolean;
}

export interface TeamRecord {
  id: string;
  code: string;
  technician_one_id: string;
  technician_two_id: string;
  vehicle_id: string;
  active: boolean;
  technician_one?: { profile?: Pick<UserProfile, 'full_name'> | null } | null;
  technician_two?: { profile?: Pick<UserProfile, 'full_name'> | null } | null;
  vehicle?: Pick<VehicleRecord, 'plate' | 'model'> | null;
}

export interface WorkOrderSummary {
  id: string;
  code: string;
  customer_name: string | null;
  address: string;
  task_type: WorkOrderType;
  status: WorkOrderStatus;
  priority: number;
  is_emergency: boolean;
  route_sequence: number | null;
  scheduled_for: string;
  assigned_team_id: string | null;
  zone?: { code: string } | null;
  node?: { code: string } | null;
  box?: { code: string } | null;
}

export interface WorkOrderHistoryRecord {
  id: number;
  previous_status: WorkOrderStatus | null;
  new_status: WorkOrderStatus;
  reason: string | null;
  changed_at: string;
  changed_by: string | null;
  actor?: { full_name: string } | null;
}

export interface SuggestedRouteStop {
  order: WorkOrderSummary;
  distanceFromPreviousKm: number | null;
}

export interface TeamSummary {
  id: string;
  code: string;
  active: boolean;
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
  isEmergency?: boolean;
  scheduledFor: string;
  zoneCode: string | null;
  nodeCode: string | null;
  boxCode: string | null;
  latitude: number | null;
  longitude: number | null;
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

export type OperationalMapMarkerType = 'team' | 'work_order' | 'network_node' | 'distribution_box';

export interface OperationalMapMarker {
  marker_type: OperationalMapMarkerType;
  marker_id: string;
  code: string;
  label: string;
  latitude: number;
  longitude: number;
  status: string;
  observed_at: string;
}

export interface WeeklyReportRow {
  team_code: string;
  team_id: string | null;
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  pending_orders: number;
  suspended_orders: number;
  completion_rate: number;
}

export interface GlobalSearchResult {
  kind: 'work_order' | 'technician' | 'vehicle' | 'team';
  id: string;
  title: string;
  subtitle: string;
}

export interface AuditLogRecord {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  occurred_at: string;
  actor?: { full_name: string } | null;
}
