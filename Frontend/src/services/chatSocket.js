import { io } from "socket.io-client";

let socket = null;

const apiBase = () => String(import.meta.env.VITE_API_URL || "").replace(/\/api\/v1\/?$/, "");

export function connectChatSocket(token) {
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(apiBase() || window.location.origin, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  return socket;
}

export function getChatSocket() {
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
