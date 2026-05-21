// FILE: src/utils/chatStorage.js

const CHAT_KEY_PREFIX = "tina_chat_history_v1";

function getChatKey(username = "guest", conversationId = "default") {
  const safeUser = String(username || "guest").trim() || "guest";
  const safeConversation = String(conversationId || "default").trim() || "default";
  return `${CHAT_KEY_PREFIX}:${safeUser}:${safeConversation}`;
}

export function loadChatHistory(username, conversationId) {
  try {
    const raw = localStorage.getItem(getChatKey(username, conversationId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages, username, conversationId) {
  try {
    if (!Array.isArray(messages)) return;
    localStorage.setItem(
      getChatKey(username, conversationId),
      JSON.stringify(messages)
    );
  } catch {
    // ignore storage errors
  }
}

export function clearChatHistory(username, conversationId) {
  try {
    localStorage.removeItem(getChatKey(username, conversationId));
  } catch {
    // ignore storage errors
  }
}
