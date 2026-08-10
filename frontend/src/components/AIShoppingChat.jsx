import { useState } from "react";
import axios from "axios";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

const AI_AGENT_API_URL =
  import.meta.env.VITE_AI_AGENT_API_URL || "http://127.0.0.1:8000";

const initialMessages = [
  {
    role: "assistant",
    text: "Hi, I can help with fashion shopping questions. I cannot search live products yet.",
  },
];

const AIShoppingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = { role: "user", text: trimmedMessage };
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      // Step 2: React sends the user's message to the Python FastAPI /chat endpoint.
      const { data } = await axios.post(`${AI_AGENT_API_URL}/chat`, {
        message: trimmedMessage,
      });

      // The Python API returns { response: "..." }, and React displays it here.
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", text: data.response },
      ]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not reach the AI service. Make sure FastAPI is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 sm:right-6">
      {isOpen && (
        <section className="mb-3 flex h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 bg-gray-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">AI Shopping Assistant</h2>
                <p className="truncate text-xs text-gray-300">Step 5: real product API</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1.5 text-gray-200 transition hover:bg-white/10 hover:text-white"
              aria-label="Close AI chat"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            {messages.map((chatMessage, index) => (
              <div
                key={`${chatMessage.role}-${index}`}
                className={`flex ${
                  chatMessage.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <p
                  className={`max-w-[85%] rounded-md px-3 py-2 text-sm leading-6 ${
                    chatMessage.role === "user"
                      ? "bg-gray-950 text-white"
                      : "border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  {chatMessage.text}
                </p>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Thinking
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 bg-white p-3">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about outfits..."
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-950 text-white shadow-xl transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-900/20"
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default AIShoppingChat;
