import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { requirePageAuth } from "@/lib/server/page-auth";

export default async function ProductsPage() {
  await requirePageAuth();
  return <CrmWorkspace module="products" />;
}
