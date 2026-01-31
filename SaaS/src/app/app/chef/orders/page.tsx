import { PageHeader } from "@/components/page-header";
import { OrdersClient } from "./orders-client";
import { getOrders } from "@/app/(chef)/procurement/order-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function OrdersPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect(ROUTES.auth.login);
    }

    const vesselId = user.vesselIds?.[0] ?? "";

    if (!vesselId) {
        redirect(ROUTES.chef.planning);
    }

    const orders = await getOrders(vesselId);

    return (
        <div className="space-y-6">
            <PageHeader
                title="発注履歴"
                description="過去の発注を確認できます。ステータスの追跡も可能です。"
                badge="Orders"
            />
            <OrdersClient orders={orders} />
        </div>
    );
}
