const messagesEl = document.getElementById("messages");
const conversationListEl = document.getElementById("conversationList");
const chatFormEl = document.getElementById("chatForm");
const promptEl = document.getElementById("prompt");
const refreshEl = document.getElementById("refreshConversations");

let currentConversationId = null;

function renderMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadConversations() {
  const response = await fetch("/api/conversations");
  const data = await response.json();

  conversationListEl.innerHTML = "";
  data.forEach((conversation) => {
    const li = document.createElement("li");
    li.textContent = conversation.title;
    li.onclick = () => loadConversation(conversation.id);
    conversationListEl.appendChild(li);
  });
}

async function loadConversation(id) {
  const response = await fetch(`/api/conversations/${id}`);
  if (!response.ok) {
    alert("Unable to load conversation");
    return;
  }

  const conversation = await response.json();
  currentConversationId = conversation.id;
  messagesEl.innerHTML = "";
  conversation.messages.forEach((message) => renderMessage(message.role, message.content));
}

chatFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptEl.value.trim();
  if (!prompt) return;

  renderMessage("user", prompt);
  promptEl.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, conversationId: currentConversationId }),
  });

  const data = await response.json();
  if (!response.ok) {
    renderMessage("assistant", data.error || "Request failed");
    return;
  }

  currentConversationId = data.conversationId;
  renderMessage("assistant", data.reply);
  await loadConversations();
});

refreshEl.addEventListener("click", loadConversations);
loadConversations();
