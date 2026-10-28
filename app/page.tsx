import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/lib/auth";
import ChatWindow from "@/components/ChatWindow";
import Navbar from "@/components/Navbar";
import Disclaimer from "@/components/Disclaimer";

export default async function Home() {
  const user = await getAuthorizedUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-screen max-w-[760px] flex-col px-5">
      <Navbar email={user.email ?? ""} />
      <Disclaimer />
      <ChatWindow />
    </div>
  );
}
