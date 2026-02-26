const messagesEl = document.getElementById("messages");
const conversationListEl = document.getElementById("conversationList");
const chatFormEl = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const refreshEl = document.getElementById("refreshConversations");
const newConversationEl = document.getElementById("newConversation");
const sendButtonEl = document.getElementById("sendButton");
const statusEl = document.getElementById("status");

const state = {
  currentConversationId: null,
  isSending: false,
};

function setStatus(message = "") {
  statusEl.textContent = message;
}

function setSending(isSending) {
  state.isSending = isSending;
  sendButtonEl.disabled = isSending;
  promptEl.disabled = isSending;
  setStatus(isSending ? "Sending message..." : "");
}

function appendMessage(role, content) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = String(content ?? "");
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
  messagesEl.innerHTML = "";
}

function renderConversationList(conversations) {
  conversationListEl.innerHTML = "";

  conversations.forEach((conversation) => {
    const item = document.createElement("li");
    item.textContent = conversation.title;
    item.className = conversation.id === state.currentConversationId ? "active" : "";
    item.onclick = () => loadConversation(conversation.id);
    conversationListEl.appendChild(item);
  });
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }

  return data;
}

async function loadConversations() {
  try {
    const conversations = await requestJson("/api/conversations");
    renderConversationList(conversations);
    setStatus("");
  } catch (error) {
    setStatus(`Failed to load conversations: ${error.message}`);
  }
}

async function loadConversation(id) {
  try {
    const conversation = await requestJson(`/api/conversations/${id}`);
    state.currentConversationId = conversation.id;
    clearMessages();
    conversation.messages.forEach((message) => appendMessage(message.role, message.content));
    await loadConversations();
    setStatus(`Loaded: ${conversation.title}`);
  } catch (error) {
    setStatus(`Unable to load conversation: ${error.message}`);
  }
}

function startNewConversation() {
  state.currentConversationId = null;
  clearMessages();
  setStatus("Started a new chat.");
  loadConversations();
  promptEl.focus();
}

async function submitPrompt() {
  const prompt = promptEl.value.trim();
  if (!prompt || state.isSending) return;

  appendMessage("user", prompt);
  promptEl.value = "";
  setSending(true);

  try {
    const payload = {
      prompt,
      conversationId: state.currentConversationId,
    };

    const result = await requestJson("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.currentConversationId = result.conversationId;
    appendMessage("assistant", result.reply);
    await loadConversations();
  } catch (error) {
    appendMessage("assistant", error.message || "Request failed");
  } finally {
    setSending(false);
    promptEl.focus();
  }
}

chatFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitPrompt();
});

promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatFormEl.requestSubmit();
  }
});

refreshEl.addEventListener("click", loadConversations);
newConversationEl.addEventListener("click", startNewConversation);

loadConversations();
