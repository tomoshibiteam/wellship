import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CrewManagementPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'MANAGER') {
        redirect('/login');
    }

    // 会社の全船舶を取得
    const vessels = await prisma.vessel.findMany({
        where: { companyId: user.companyId },
        include: {
            crewMembers: {
                orderBy: { name: 'asc' },
            },
        },
        orderBy: { name: 'asc' },
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="クルー管理"
                description="船員のカード登録と管理"
                badge="管理機能"
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {vessels.map((vessel) => (
                    <div
                        key={vessel.id}
                        className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_12px_32px_rgba(14,94,156,0.06)]"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    🚢 {vessel.name}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {vessel.crewMembers.length}名登録済み
                                </p>
                            </div>
                            <button
                                disabled
                                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
                            >
                                + 追加（準備中）
                            </button>
                        </div>

                        <div className="space-y-2">
                            {vessel.crewMembers.length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-500">
                                    登録されている船員がいません
                                </p>
                            ) : (
                                vessel.crewMembers.map((crew) => (
                                    <div
                                        key={crew.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg">
                                                🪪
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{crew.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    カード: {crew.cardCode}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                            有効
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                    💡 船員カードの追加・編集機能は今後のアップデートで実装予定です。
                    現在はデモデータが登録されています。
                </p>
            </div>
        </div>
    );
}
