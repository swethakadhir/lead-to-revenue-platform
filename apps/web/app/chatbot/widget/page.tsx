import { ChatWidget } from "@/components/chatbot/chat-widget";

export default async function PublicChatbotWidget({ searchParams }: { searchParams: Promise<{ widget?: string }> }) {
  const { widget } = await searchParams;
  if (!widget) return <main className="p-4 text-sm">Chatbot identifier required.</main>;
  return <main className="min-h-screen bg-transparent"><ChatWidget floating widgetId={widget} /></main>;
}
