"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
// The socket.io namespace lives at the API origin, not under /v1.
const SOCKET_URL = API_BASE.replace(/\/v1\/?$/, "");

/**
 * Subscribe to a single conversation room for live message delivery. Calls
 * `onMessage` when a new message arrives and `onRead` when the other party
 * reads. Degrades gracefully — if the socket can't connect the screen still
 * works via its initial fetch.
 */
export function useMessagesSocket(
  conversationId: string | undefined,
  handlers: { onMessage?: (m: ChatMessage) => void; onRead?: (p: { userId: string }) => void },
) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!conversationId) return;
    let socket: Socket | null = null;
    try {
      socket = io(`${SOCKET_URL}/messages`, { transports: ["websocket"], reconnection: true });
      socket.on("connect", () => socket?.emit("join", { conversationId }));
      socket.on("message:new", (m: ChatMessage) => ref.current.onMessage?.(m));
      socket.on("message:read", (p: { userId: string }) => ref.current.onRead?.(p));
    } catch {
      // optional channel
    }
    return () => {
      try {
        socket?.emit("leave", { conversationId });
        socket?.disconnect();
      } catch {
        /* noop */
      }
    };
  }, [conversationId]);
}
