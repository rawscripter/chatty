import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChatLayout } from "@/components/chat/chat-layout";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ChatLayout />;
}
