// FILE: src/utils/chatStorage.js

const CHAT_KEY = "tina_chat_history_v1";

export function loadChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages || []));
  } catch {
    // ignore storage errors
  }
}

export function clearChatHistory() {
  localStorage.removeItem(CHAT_KEY);
}
