import type { ManagerRange, ManagerScope } from './types';

export const managerRanges: ManagerRange[] = ['7d', '30d', '90d'];

export function parseScope(value: string | null | undefined): ManagerScope {
  if (!value) return 'all';
  if (value === 'all') return 'all';
  if (value.startsWith('vessel:') && value.split(':')[1]) {
    return value as ManagerScope;
  }
  return 'all';
}

export function parseRange(value: string | null | undefined): ManagerRange {
  if (value === '30d' || value === '90d' || value === '7d') {
    return value;
  }
  return '7d';
}

export function scopeToVesselId(scope: ManagerScope): string | null {
  if (scope === 'all') return null;
  return scope.replace('vessel:', '');
}

export function vesselIdToScope(vesselId: string | null): ManagerScope {
  if (!vesselId) return 'all';
  return `vessel:${vesselId}`;
}
