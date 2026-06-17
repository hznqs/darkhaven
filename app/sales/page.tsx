import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function SalesPage() {
  await requirePageAuth();
  return <CrmWorkspace module="sales" />;
}
