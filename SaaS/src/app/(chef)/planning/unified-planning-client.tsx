'use client';

import { useState } from 'react';
import PlanningGenerator from './planning-generator';
import ProcurementGenerator from '../procurement/procurement-generator';
import type { GeneratedDay } from './actions';
import type { DefaultStartDate } from '../procurement/types';

type TabType = 'planning' | 'procurement';

type PlanRangeMeta = {
    startDate: string;
    endDate: string;
    days: number;
} | null;

export type VesselSettings = {
    defaultSeason: string | null;
    defaultMaxCookingTime: number | null;
};

interface UnifiedPlanningClientProps {
    initialPlan: GeneratedDay[] | null;
    latestRange: PlanRangeMeta;
    vesselId: string;
    defaultProcurementStartDate: DefaultStartDate;
    vesselSettings: VesselSettings;
}

export function UnifiedPlanningClient({
    initialPlan,
    latestRange,
    vesselId,
    defaultProcurementStartDate,
    vesselSettings,
}: UnifiedPlanningClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>('planning');
    const [procurementRefreshKey, setProcurementRefreshKey] = useState(0);

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        // 調達リストタブに切り替えた時はデータを再取得
        if (tab === 'procurement') {
            setProcurementRefreshKey(prev => prev + 1);
        }
    };

    return (
        <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex rounded-xl border border-sky-100 bg-white p-1 shadow-sm">
                <button
                    onClick={() => switchTab('planning')}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'planning'
                        ? 'bg-gradient-to-r from-sky-600 to-teal-500 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    🧭 献立プラン
                </button>
                <button
                    onClick={() => switchTab('procurement')}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'procurement'
                        ? 'bg-gradient-to-r from-sky-600 to-teal-500 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    📦 調達リスト
                </button>
            </div>

            {/* Tab Content - Both always rendered, visibility controlled by CSS */}
            <div className={activeTab === 'planning' ? 'block' : 'hidden'}>
                <PlanningGenerator
                    initialPlan={initialPlan}
                    latestRange={latestRange}
                    vesselId={vesselId}
                    vesselSettings={vesselSettings}
                />
            </div>
            <div className={activeTab === 'procurement' ? 'block' : 'hidden'}>
                <ProcurementGenerator
                    initialStartDate={defaultProcurementStartDate}
                    refreshKey={procurementRefreshKey}
                />
            </div>
        </div>
    );
}

