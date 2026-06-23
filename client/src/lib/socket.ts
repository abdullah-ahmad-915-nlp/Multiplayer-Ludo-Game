import { io, Socket } from "socket.io-client";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string) || "http://localhost:8000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: false });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }
}

export default getSocket;
