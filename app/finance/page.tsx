import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function FinancePage() {
  await requirePageAuth();
  return <CrmWorkspace module="finance" />;
}
