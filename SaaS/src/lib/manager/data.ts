import type {
  AlertItem,
  AlertStatus,
  CrewMember,
  FeedbackReasonStat,
  FeedbackTrendPoint,
  ManagerRange,
  ManagerScope,
  ManagerUser,
  RecipeStat,
  Vessel,
  VesselDetail,
} from './types';

const emptyVessels: Vessel[] = [];
const emptyAlerts: AlertItem[] = [];
const emptyTrend: FeedbackTrendPoint[] = [];
const emptyReasons: FeedbackReasonStat[] = [];
const emptyRecipes: RecipeStat[] = [];
const emptyUsers: ManagerUser[] = [];
const emptyCrew: CrewMember[] = [];
const emptyVesselDetails: Record<string, VesselDetail> = {};

const rangeFactor: Record<ManagerRange, number> = {
  '7d': 1,
  '30d': 1.05,
  '90d': 1.1,
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const applyRange = (rate: number, range: ManagerRange) =>
  clamp(rate * rangeFactor[range]);

const applyRangeToMetrics = (vessel: Vessel, range: ManagerRange): Vessel => ({
  ...vessel,
  metrics: {
    ...vessel.metrics,
    responseRate: applyRange(vessel.metrics.responseRate, range),
    positiveRate: applyRange(vessel.metrics.positiveRate, range),
    negativeRate: applyRange(vessel.metrics.negativeRate, range),
    changeRate: applyRange(vessel.metrics.changeRate, range),
  },
});

const filterByScope = (scope: ManagerScope, vessels: Vessel[]) => {
  if (scope === 'all') return vessels;
  const id = scope.replace('vessel:', '');
  return vessels.filter((vessel) => vessel.id === id);
};

const filterAlertsByScope = (scope: ManagerScope, alerts: AlertItem[]) => {
  if (scope === 'all') return alerts;
  const id = scope.replace('vessel:', '');
  return alerts.filter((alert) => alert.vesselId === id);
};

const applyRangeToReasons = (reasons: FeedbackReasonStat[], range: ManagerRange) =>
  reasons.map((reason) => ({
    ...reason,
    rate: clamp(reason.rate * rangeFactor[range]),
    count: Math.round(reason.count * rangeFactor[range]),
  }));

const applyRangeToRecipes = (recipes: RecipeStat[], range: ManagerRange) =>
  recipes.map((recipe) => ({
    ...recipe,
    positiveRate: clamp(recipe.positiveRate * rangeFactor[range]),
    negativeRate: clamp(recipe.negativeRate * rangeFactor[range]),
    responses: Math.round(recipe.responses * rangeFactor[range]),
  }));

const applyRangeToTrend = (trend: FeedbackTrendPoint[], range: ManagerRange) =>
  trend.map((point) => ({
    ...point,
    positiveRate: clamp(point.positiveRate * rangeFactor[range]),
    negativeRate: clamp(point.negativeRate * rangeFactor[range]),
    responseRate: clamp(point.responseRate * rangeFactor[range]),
  }));

export function getManagerVessels(scope: ManagerScope, range: ManagerRange): Vessel[] {
  const scoped = filterByScope(scope, emptyVessels);
  return scoped.map((vessel) => applyRangeToMetrics(vessel, range));
}

export function getDashboardSummary(scope: ManagerScope, range: ManagerRange) {
  const vessels = getManagerVessels(scope, range);
  const alerts = filterAlertsByScope(scope, emptyAlerts)
    .filter((alert) => alert.status === 'open')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const avg = (key: keyof Vessel['metrics']) =>
    vessels.length === 0
      ? 0
      : vessels.reduce((sum, vessel) => sum + (vessel.metrics[key] as number), 0) /
      vessels.length;

  const responseRate = avg('responseRate');
  const positiveRate = avg('positiveRate');
  const negativeRate = avg('negativeRate');
  const changeRate = avg('changeRate');

  const criticalCount = vessels.filter((vessel) => vessel.status === 'critical').length;
  const warnCount = vessels.filter((vessel) => vessel.status === 'warn').length;

  const summaryText =
    vessels.length === 0
      ? '対象となる船舶がありません。'
      : criticalCount > 0
        ? `⚠️ ${criticalCount}隻で深刻なアラートが発生しています。回答率と献立変更を優先確認してください。`
        : warnCount > 0
          ? `注意が必要な船が${warnCount}隻あります。直近の献立変更と不満理由を確認しましょう。`
          : '全体的に安定しています。次の改善テーマを検討しましょう。';

  return {
    kpis: [
      {
        label: '回答率',
        value: `${Math.round(responseRate * 100)}%`,
        trend: '—',
      },
      {
        label: '👍率',
        value: `${Math.round(positiveRate * 100)}%`,
        trend: '—',
      },
      {
        label: '👎率',
        value: `${Math.round(negativeRate * 100)}%`,
        trend: '—',
      },
      {
        label: '当日変更率',
        value: `${Math.round(changeRate * 100)}%`,
        trend: '—',
      },
    ],
    vessels,
    alerts: alerts.slice(0, 5),
    summaryText,
  };
}

export function getVesselDetail(vesselId: string, range: ManagerRange): VesselDetail | null {
  const detail = emptyVesselDetails[vesselId];
  if (!detail) return null;
  return {
    ...detail,
    vessel: applyRangeToMetrics(detail.vessel, range),
    reasons: applyRangeToReasons(detail.reasons, range),
    recipes: applyRangeToRecipes(detail.recipes, range),
  };
}

export function getFeedbackSummary(scope: ManagerScope, range: ManagerRange) {
  const reasons = applyRangeToReasons(emptyReasons, range);
  const recipes = applyRangeToRecipes(emptyRecipes, range);
  return {
    trend: applyRangeToTrend(emptyTrend, range),
    reasons,
    recipes,
    vesselCount: filterByScope(scope, emptyVessels).length,
  };
}

export function getAlerts(
  scope: ManagerScope,
  range: ManagerRange,
  status: AlertStatus
): AlertItem[] {
  const scoped = filterAlertsByScope(scope, emptyAlerts);
  return scoped
    .filter((alert) => alert.status === status)
    .map((alert) => ({
      ...alert,
      indicators: alert.indicators.map((indicator) => ({
        ...indicator,
        value: indicator.value,
      })),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAlertCount(scope: ManagerScope, range: ManagerRange): number {
  return getAlerts(scope, range, 'open').length;
}

export function getCrewMembers(vesselId: string) {
  return emptyCrew.filter((member) => member.vesselId === vesselId);
}

export function getManagerUsers() {
  return emptyUsers;
}
