import { isAuthorized } from "@/lib/auth";
import ChatShell from "@/components/ChatShell";

export default async function Home() {
  const authorized = await isAuthorized();
  return <ChatShell initialAuthorized={authorized} />;
}
