import { ChatLayout } from "@/components/chat/ChatLayout";

export const metadata = {
  title: "AI Assistant",
};

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  return <ChatLayout chatId={chatId} />;
}
