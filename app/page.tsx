import { redirect } from "next/navigation";
import { isAuthorized } from "@/lib/auth";
import ChatWindow from "@/components/ChatWindow";
import Navbar from "@/components/Navbar";

export default async function Home() {
  const ok = await isAuthorized();
  if (!ok) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen max-w-[760px] flex-col px-5">
      <Navbar />
      <ChatWindow />
    </div>
  );
}
