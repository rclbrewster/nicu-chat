import { redirect } from "next/navigation";
import { isAuthorized } from "@/lib/auth";
import ChatShell from "@/components/ChatShell";

export default async function Home() {
  const ok = await isAuthorized();
  if (!ok) redirect("/login");

  return <ChatShell />;
}
