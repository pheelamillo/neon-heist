"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, ensureIdentity, getSupabase, isLocal, roomAction } from "./api";
import type { Command, RoomView } from "@/lib/game/types";

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [needsJoin, setNeedsJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "polling" | "offline">("connecting");
  const [now, setNow] = useState(0);
  const timing = useRef({ server: 0, client: 0 });
  const current = useRef<RoomView | null>(null);
  const alive = useRef(true);
  const networkError = useRef("");

  const accept = useCallback((view: RoomView, elapsed: number) => {
    if (!alive.current || (current.current && (view.version < current.current.version ||
      (view.version === current.current.version && view.serverNow < current.current.serverNow)))) return;
    current.current = view;
    timing.current = { server: view.serverNow + elapsed / 2, client: performance.now() };
    setRoom(view);
    setNeedsJoin(false);
  }, []);

  const refresh = useCallback(async () => {
    const started = performance.now();
    try {
      const view = await api<RoomView>(`/api/rooms/${code}`);
      accept(view, performance.now() - started);
      if (networkError.current) {
        const previous = networkError.current;
        networkError.current = "";
        setError((message) => message === previous ? "" : message);
      }
      return true;
    } catch (error) {
      if (!alive.current) return false;
      if (error instanceof ApiError && error.status === 403) setNeedsJoin(true);
      else { networkError.current = error instanceof Error ? error.message : "Unable to connect.";
        setError(networkError.current); setConnection("offline"); }
      return false;
    }
  }, [code, accept]);

  useEffect(() => {
    alive.current = true;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const ok = await refresh();
      if (disposed) return;
      if (ok) setConnection((previous) => previous === "live" ? "live" : "polling");
      const deadline = current.current?.deadline;
      const untilDeadline = deadline ? deadline - (timing.current.server + performance.now() - timing.current.client) + 80 : Infinity;
      timer = setTimeout(poll, Math.min(isLocal ? 1200 : 4000, Math.max(150, untilDeadline)));
    }
    void poll();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const clock = setInterval(() => setNow(timing.current.server + performance.now() - timing.current.client), 150);
    return () => { disposed = true; alive.current = false; clearTimeout(timer); clearInterval(clock);
      window.removeEventListener("online", visible); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  const roomId = room?.id;
  useEffect(() => {
    if (isLocal || !roomId) return;
    let disposed = false;
    const client = getSupabase()!;
    const channel = client.channel(`heist:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_updates", filter: `room_id=eq.${roomId}` }, () => { void refresh(); });
    void ensureIdentity().then(async () => {
      const { data } = await client.auth.getSession();
      if (disposed) return;
      await client.realtime.setAuth(data.session?.access_token);
      if (disposed) return;
      channel.subscribe((status) => {
        if (disposed) return;
        setConnection(status === "SUBSCRIBED" ? "live" : "polling");
        if (status === "SUBSCRIBED") void refresh();
      });
    }).catch(() => { if (!disposed) setConnection("polling"); });
    return () => { disposed = true; void client.removeChannel(channel); };
  }, [roomId, refresh]);

  async function act(command: Command) {
    if (!current.current || busy) return;
    setBusy(true); setError("");
    const started = performance.now();
    try {
      const view = await roomAction(current.current, command);
      if (view) accept(view, performance.now() - started);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Your plan could not be sent.");
      await refresh();
      return false;
    } finally { setBusy(false); }
  }

  async function join(nickname: string) {
    setBusy(true); setError("");
    const started = performance.now();
    try { accept(await api<RoomView>(`/api/rooms/${code}`, "POST", { nickname }), performance.now() - started); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to join."); }
    finally { setBusy(false); }
  }

  return { room, error, busy, needsJoin, connection, now, act, join, refresh, clearError: () => setError("") };
}
