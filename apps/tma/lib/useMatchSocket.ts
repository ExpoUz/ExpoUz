"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
// The socket.io namespace lives at the API origin, not under /v1.
const SOCKET_URL = API_BASE.replace(/\/v1\/?$/, "");

/**
 * Subscribe to live updates for a match (player joined/left, status changed)
 * and invoke `onChange` so the caller can refetch. Degrades gracefully — if the
 * socket can't connect, the UI still works via manual/refetch updates.
 */
export function useMatchSocket(matchId: string | undefined, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!matchId) return;
    let socket: Socket | null = null;
    try {
      socket = io(`${SOCKET_URL}/matches`, { transports: ["websocket"], reconnection: true });
      socket.on("connect", () => socket?.emit("join-room", { matchId }));
      const handler = () => cb.current();
      socket.on("match:player-joined", handler);
      socket.on("match:player-left", handler);
      socket.on("match:status-changed", handler);
    } catch {
      // optional channel
    }
    return () => {
      try {
        socket?.emit("leave-room", { matchId });
        socket?.disconnect();
      } catch {
        /* noop */
      }
    };
  }, [matchId]);
}
