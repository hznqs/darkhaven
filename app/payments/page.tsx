import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function PaymentsPage() {
  await requirePageAuth();
  return <CrmWorkspace module="payments" />;
}
