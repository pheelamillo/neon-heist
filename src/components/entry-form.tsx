"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Radio } from "lucide-react";
import { api } from "@/lib/client/api";
import type { RoomView } from "@/lib/game/types";

export function EntryForm({ fixedCode, onJoin, busy: externalBusy = false }: { fixedCode?: string; onJoin?: (nickname: string) => Promise<void>; busy?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join" | "practice">(fixedCode ? "join" : "practice");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(fixedCode ?? "");
  const [seconds, setSeconds] = useState(45);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);

  async function enter(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const name = nickname.trim() || (mode === "practice" ? "Player" : "");
      if (fixedCode && onJoin) { await onJoin(name); return; }
      const view = mode !== "join" ? await api<RoomView>("/api/rooms", "POST", { nickname: name, roundSeconds: seconds, mode: mode === "practice" ? "practice" : "multiplayer" }) :
        await api<RoomView>(`/api/rooms/${code.trim().toUpperCase()}`, "POST", { nickname: name });
      router.push(`/room/${view.code}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to enter the room."); }
    finally { setBusy(false); }
  }

  const pending = busy || externalBusy || !interactive;
  return <div className="entry-card"><div className="card-kicker"><Radio size={14}/><span>{fixedCode ? `ROOM ${fixedCode}` : "LET’S PLAY"}</span><span className="signal-bars">▂▄▆</span></div>
    {!fixedCode && <div className="entry-tabs" role="tablist" aria-label="Room action">{([ ["practice", "Vs computer"], ["create", "With friends"], ["join", "Join room"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={busy} onClick={() => { setMode(value); setError(""); }}>{label}</button>)}</div>}
    <h2 className="entry-title">{fixedCode ? "Join your friends." : mode === "practice" ? "Your first getaway." : mode === "create" ? "Bring your crew." : "Got a room code?"}</h2>
    <p className="entry-explanation">{mode === "practice" ? "Just you and Byte, the computer. Jump in and learn as you go." : mode === "create" ? "Create a room. Send the code to a friend. Play on separate devices." : "Enter your name and the code your friend shared."}</p>
    <form onSubmit={enter}><label htmlFor="nickname">YOUR NAME{mode === "practice" ? " (OPTIONAL)" : ""}</label><input id="nickname" name="nickname" autoComplete="nickname" placeholder={mode === "practice" ? "Player (or type your name)" : "What should we call you?"} minLength={2} maxLength={18} value={nickname} onChange={(event) => setNickname(event.target.value)} required={mode !== "practice"} disabled={pending}/>
      {mode === "join" && !fixedCode && <><label htmlFor="room-code">ROOM CODE</label><input id="room-code" className="code-input" name="code" autoComplete="off" placeholder="6-CHARACTER CODE" minLength={6} maxLength={6} pattern="[A-Za-z2-9]{6}" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required disabled={pending}/></>}
      {mode !== "join" && <details className="timer-options"><summary>Round timer: {seconds} seconds</summary><fieldset className="round-length"><legend>TIME TO CHOOSE A VAULT</legend><div>{[20, 45, 60].map((value) => <label className={seconds === value ? "selected" : ""} key={value}><input type="radio" name="roundSeconds" value={value} checked={seconds === value} onChange={() => setSeconds(value)} disabled={pending}/>{value}s</label>)}</div></fieldset></details>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary entry-submit" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={18} className="spin"/> Getting ready…</> : <>{mode === "practice" ? "Play vs computer" : mode === "create" ? "Create the room" : "Join the crew"}<ArrowRight size={18}/></>}</button>
    </form><p className="entry-note">Four quick rounds. No account. No download.</p>
  </div>;
}
