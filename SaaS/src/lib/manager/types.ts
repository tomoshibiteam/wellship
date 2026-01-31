export type ManagerRange = '7d' | '30d' | '90d';
export type ManagerScope = 'all' | `vessel:${string}`;

export type VesselStatus = 'ok' | 'warn' | 'critical';
export type AlertStatus = 'open' | 'done';
export type AlertSeverity = 'low' | 'medium' | 'high';

export type AlertType = 'response_drop' | 'negative_spike' | 'menu_change_spike';

export interface VesselMetricSnapshot {
  responseRate: number;
  positiveRate: number;
  negativeRate: number;
  changeRate: number;
  lastUpdated: string;
  alerts: number;
}

export interface Vessel {
  id: string;
  name: string;
  imoNumber: string;
  chefName: string;
  crewSize: number;
  status: VesselStatus;
  metrics: VesselMetricSnapshot;
  note?: string;
}

export interface DashboardKpi {
  label: string;
  value: string;
  trend: string;
}

export interface AlertItem {
  id: string;
  vesselId: string;
  vesselName: string;
  type: AlertType;
  severity: AlertSeverity;
  createdAt: string;
  status: AlertStatus;
  summary: string;
  indicators: { label: string; value: string }[];
  reasons: string[];
  recipes: string[];
}

export interface FeedbackTrendPoint {
  date: string;
  positiveRate: number;
  negativeRate: number;
  responseRate: number;
}

export interface FeedbackReasonStat {
  reason: string;
  rate: number;
  count: number;
}

export interface RecipeStat {
  id: string;
  name: string;
  positiveRate: number;
  negativeRate: number;
  responses: number;
}

export interface VesselDetail {
  vessel: Vessel;
  reasons: FeedbackReasonStat[];
  recipes: RecipeStat[];
  notes: string;
}

export interface CrewMember {
  id: string;
  vesselId: string;
  alias: string;
  cardBound: boolean;
  cardUid?: string;
  dietFlags: string[];
  spiceTolerance: 'low' | 'mid' | 'high';
  saltPreference: 'normal' | 'low';
}

export interface ManagerUser {
  id: string;
  name: string;
  email: string;
  role: 'CHEF' | 'MANAGER';
  vessels: string[];
  status: 'active' | 'invited' | 'disabled';
  phone?: string | null;
  lastLoginAt?: string | null;
  invitedAt?: string | null;
  disabledAt?: string | null;
}

export interface ManagerCompany {
  id: string;
  name: string;
}
