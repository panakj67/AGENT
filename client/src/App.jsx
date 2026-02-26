import { useEffect, useMemo, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";

function endpoint(path) {
  return `${apiBase}${path}`;
}

async function fetchJson(path, options) {
  const response = await fetch(endpoint(path), options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

function Message({ role, content }) {
  return <div className={`message ${role}`}>{content}</div>;
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const title = useMemo(() => "Aura Client", []);

  async function loadConversations() {
    try {
      const data = await fetchJson("/api/conversations");
      setConversations(data);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loadConversation(id) {
    try {
      const data = await fetchJson(`/api/conversations/${id}`);
      setConversationId(data.id);
      setMessages(data.messages || []);
      setStatus(`Loaded conversation: ${data.title}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function sendPrompt(event) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const nextUser = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, nextUser]);
    setPrompt("");
    setLoading(true);
    setStatus("");

    try {
      const data = await fetchJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, conversationId }),
      });

      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      await loadConversations();
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: error.message }]);
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setStatus("Started a new chat");
  }

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <main className="app">
      <aside className="sidebar">
        <h2>Conversations</h2>
        <div className="actions">
          <button onClick={startNewChat}>New chat</button>
          <button onClick={loadConversations}>Refresh</button>
        </div>
        <ul>
          {conversations.map((item) => (
            <li
              key={item.id}
              onClick={() => loadConversation(item.id)}
              className={item.id === conversationId ? "active" : ""}
            >
              {item.title}
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat">
        <h1>{title}</h1>
        <p className="status">{status}</p>
        <div className="messages">
          {messages.map((message, index) => (
            <Message key={`${message.role}-${index}`} role={message.role} content={message.content} />
          ))}
        </div>
        <form onSubmit={sendPrompt}>
          <textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Type your prompt..."
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
