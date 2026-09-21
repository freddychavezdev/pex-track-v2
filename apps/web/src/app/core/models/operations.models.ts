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
