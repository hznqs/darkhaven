import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasValidSessionToken, sessionCookieName } from "@/lib/server/security";

export async function requirePageAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!hasValidSessionToken(token)) {
    redirect("/login");
  }
}
