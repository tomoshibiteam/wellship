import { PageHeader } from "@/components/page-header";
import { OrdersClient } from "./orders-client";
import { getAllOrders } from "@/app/(chef)/procurement/order-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function ManagerOrdersPage() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'MANAGER') {
        redirect(ROUTES.auth.login);
    }

    const orders = await getAllOrders();

    return (
        <div className="space-y-6">
            <PageHeader
                title="発注履歴"
                description="全船舶の発注状況を一元管理します。"
                badge="Vessel Orders"
            />
            <OrdersClient orders={orders} />
        </div>
    );
}
