import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function PostSalesPage() {
  await requirePageAuth();
  return <CrmWorkspace module="post-sales" />;
}
