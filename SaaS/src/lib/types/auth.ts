// 認証・テナント関連の型定義

export type UserRole = 'CHEF' | 'MANAGER' | 'SUPPLIER';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  companyId: string;
  vesselIds: string[];
}

export interface Company {
  id: string;
  name: string;
  slug: string;
}

export interface Vessel {
  id: string;
  name: string;
  imoNumber: string | null;
  companyId: string;
}

export interface VesselMembership {
  id: string;
  userId: string;
  vesselId: string;
  role: UserRole | null;
}
