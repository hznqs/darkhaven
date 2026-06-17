import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function OrdersPage() {
  await requirePageAuth();
  return <CrmWorkspace module="orders" />;
}
