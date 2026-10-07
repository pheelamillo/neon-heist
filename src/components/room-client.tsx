"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, Coins, Copy, Crown, DoorOpen, LoaderCircle, LockKeyhole, Play, RotateCcw, Shield, Skull, Trophy, Users, X } from "lucide-react";
import { Header, Footer } from "./brand";
import { EntryForm } from "./entry-form";
import { VaultScene, VAULT_COLORS } from "./vault-scene";
import { VaultDemo } from "./vault-demo";
import { OperativePortrait } from "./operative-portrait";
import { StageBanner } from "./stage-tour";
import { stageForRound } from "@/lib/game/stages";
import { useRoom } from "@/lib/client/use-room";
import { credits, TOTAL_ROUNDS, vaultsForRound } from "@/lib/game/catalog";
import type { Command, RoomView } from "@/lib/game/types";

type Act = (command: Command) => Promise<boolean | undefined>;

export function RoomClient({ code }: { code: string }) {
  const { room, error, needsJoin, busy, connection, now, act, join, refresh, clearError } = useRoom(code);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  return <div className="site-shell new-game room-shell"><Header><span className={`connection ${connection}`}><span className="status-dot"/>{connection === "offline" ? "RECONNECTING" : connection === "connecting" ? "CONNECTING" : "CONNECTED"}</span></Header><main className="room-main">
    {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={clearError}><X size={16}/></button></div>}
    {!room && needsJoin ? <div className="join-screen"><h1>Join the<br/><span>getaway.</span></h1><EntryForm fixedCode={code} onJoin={join} busy={busy}/><Link href="/" className="text-link"><ArrowLeft size={15}/> Back to play</Link></div> : !room ? <div className="loading-screen"><LoaderCircle className="spin" size={32}/><h2>{error ? "Let’s reconnect." : "Getting your vaults ready…"}</h2><button className="button secondary" onClick={() => void refresh()}>Reconnect</button><Link href="/">Back to play</Link></div> : room.rulesVersion !== 2 ?
      <div className="old-room"><h1>A new getaway is ready.</h1><p>This room belongs to the earlier game. Start a fresh room to try the simpler game with interactive 3D vaults.</p><Link href="/" className="button primary">Try the new game <ArrowRight size={17}/></Link></div> : <>
      <div className="game-heading"><div><span className="eyebrow">{room.mode === "practice" ? "YOU VS BYTE · SOLO PRACTICE" : "YOUR FRIENDS. YOUR GETAWAY."}</span><h1>{room.phase === "lobby" ? "Who’s coming?" : room.phase === "finished" ? "The final loot." : `Round ${room.round} of ${TOTAL_ROUNDS}`}</h1></div><button className="help-button" aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)}><Play size={15}/> {showHelp ? "Close demo" : "Show me how"}</button></div>
      {showHelp && <VaultDemo compact/>}
      <div className="room-layout"><section className="room-stage">{room.phase === "lobby" ? <Lobby room={room} busy={busy} act={act} onLeave={async () => { if (await act({ type: "leave" })) router.push("/"); }}/> : room.phase === "finished" ? <Finale room={room} busy={busy} act={act}/> : <Heist key={`${room.matchId}:${room.round}`} room={room} busy={busy} now={now} act={act}/>}</section><aside className="room-sidebar"><Crew room={room}/>{room.mode === "multiplayer" && room.phase === "lobby" && <Invite code={code}/>}<div className="simple-tip"><Coins size={24}/><h3>Alone? Take it all.</h3><p>Same vault as someone else?<br/>Split the loot.</p><span>Four rounds. Biggest total wins.</span></div>{room.history.length > 0 && <History room={room}/>}</aside></div>
    </>}
  </main><Footer/></div>;
}

function Invite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false); const [manual, setManual] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setManual(true); }
  }
  return <div className="invite"><span>SEND THIS CODE TO A FRIEND</span><div><strong>{code}</strong><button onClick={() => void copy()} aria-label="Copy invite link">{copied ? <Check size={18}/> : <Copy size={18}/>}</button></div><small>{copied ? "Invite link copied" : "They can join from their own device."}</small>{manual && <input aria-label="Invite link" readOnly value={`${window.location.origin}/room/${code}`} onFocus={(event) => event.target.select()}/>}</div>;
}

function Lobby({ room, busy, act, onLeave }: { room: RoomView; busy: boolean; act: Act; onLeave: () => Promise<void> }) {
  const me = room.players.find((player) => player.id === room.me)!;
  const host = room.hostId === room.me;
  const everyoneReady = room.players.length >= 2 && room.players.every((player) => player.ready);
  return <div className="simple-lobby"><VaultScene vaults={[vaultsForRound(1)[2]]} disabled/><h2>Your crew is almost ready.</h2><p>Pick a vault. Share the loot if friends pick it too.<br/>Most loot after four rounds wins.</p><div className="lobby-actions">{host ? <button className="button primary" disabled={busy || !everyoneReady} onClick={() => void act({ type: "start" })}><Play size={18}/> Start playing</button> : <button className={`button ${me.ready ? "secondary" : "primary"}`} disabled={busy} onClick={() => void act({ type: "ready", ready: !me.ready })}><Check size={18}/>{me.ready ? "Ready!" : "I’m ready"}</button>}<span>{room.players.length < 2 ? "Send the code to at least one friend." : everyoneReady ? host ? "Everyone’s here. Let’s go!" : "Waiting for the host to start." : "Waiting for everyone to tap ready."}</span></div><button className="leave-link" disabled={busy} onClick={() => void onLeave()}><DoorOpen size={14}/> Leave room</button></div>;
}

function Crew({ room }: { room: RoomView }) {
  const players = room.phase === "finished" ? [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : room.players;
  return <div className="crew-card"><div className="crew-heading"><h2>{room.phase === "finished" ? "Final totals" : "The crew"}</h2><span><Users size={14}/>{room.mode === "practice" ? "1 vs PC" : `${room.players.length}/8`}</span></div><div className="crew-list">{players.map((player, index) => <div className={`crew-player ${player.id === room.me ? "is-me" : ""}`} key={player.id}><span className={`avatar avatar-${index % 6}`}>{player.isComputer ? <Bot size={20}/> : player.nickname.slice(0, 1).toUpperCase()}</span><div className="crew-name"><strong>{player.nickname}{player.id === room.me && <small>YOU</small>}{player.isComputer && <small>PC</small>}{player.id === room.hostId && <Crown size={13} aria-label="Host"/>}</strong><span>{room.phase === "lobby" ? player.ready ? "Ready!" : "Not ready yet" : room.phase === "planning" ? player.submitted ? "Choice locked" : "Choosing a vault" : player.doubleCrossAvailable ? "One steal left" : "Steal used"}</span></div>{room.phase === "lobby" ? <span className="ready-badge ready">{player.ready && <Check size={16}/>}</span> : <strong className="score" data-testid={`score-${player.nickname}`}>{player.score === null ? "HIDDEN" : credits(player.score)}</strong>}</div>)}</div><div className="crew-bottom"><Shield size={14}/> Opponents’ totals reveal at the end.</div></div>;
}

function Heist({ room, busy, now, act }: { room: RoomView; busy: boolean; now: number; act: Act }) {
  const [target, setTarget] = useState<number | null>(null);
  const [steal, setSteal] = useState(false);
  const me = room.players.find((player) => player.id === room.me)!;
  const submitted = room.mySubmission;
  const selected = submitted?.target ?? target;
  const revealing = room.phase === "reveal";
  const locked = !!submitted || revealing;
  const seconds = Math.max(0, Math.ceil(((room.deadline ?? 0) - (now || room.serverNow)) / 1000));
  const result = revealing ? room.history.at(-1)! : null;
  const canSubmit = selected !== null && !locked && !busy && seconds > 0;
  const crossActive = submitted?.doubleCross ?? steal;
  const stage = stageForRound(room.round);
  return <div className="vault-game"><div className="play-hud"><div><span className="eyebrow">YOUR LOOT</span><strong><Coins size={22}/>{credits(me.score ?? 0)}</strong></div><div className="round-dots" aria-label={`Round ${room.round} of 4`}>{[1, 2, 3, 4].map((round) => <span key={round} className={round <= room.round ? "active" : ""}>{round}</span>)}</div><div className={`simple-timer ${seconds <= 10 && !revealing ? "urgent" : ""}`} role="timer"><strong>{seconds}<small>s</small></strong><span>{revealing ? room.round === 4 ? "Final totals in" : "Next round in" : "Time to pick"}</span></div></div>
    <StageBanner stage={stage}/><div className="play-instruction"><h2>{revealing ? "Here’s your getaway!" : submitted ? "Your choice is locked." : "Which vault is yours?"}</h2><p>{revealing ? "The doors are open. See who went where." : submitted ? "Waiting for the other players. Your choice stays secret." : "Tap a vault, then press Grab loot. An empty vault is all yours."}</p></div>
    <VaultScene stage={stage} vaults={room.targets} selected={selected} open={result?.targets.filter((entry) => entry.success && !entry.alarm).map((entry) => entry.target.id) ?? []} alarms={result?.targets.filter((entry) => entry.alarm).map((entry) => entry.target.id) ?? []} disabled={locked || busy || seconds === 0} onSelect={setTarget}/>
    <div className="vault-choices">{room.targets.map((vault) => {
      const outcome = result?.targets.find((entry) => entry.target.id === vault.id);
      return <button key={vault.id} className={`vault-choice ${selected === vault.id ? "chosen" : ""}`} aria-pressed={selected === vault.id} aria-label={`Choose ${vault.name}, ${credits(vault.loot)} loot`} disabled={locked || busy || seconds === 0} onClick={() => setTarget(vault.id)} style={{ "--vault-color": VAULT_COLORS[vault.id] } as React.CSSProperties}><span className="vault-choice-name">{vault.name}{selected === vault.id && <Check size={17}/>}</span><strong><Coins size={17}/>{credits(vault.loot)}</strong><span>{revealing ? outcome?.alarm ? "Alarm! No loot." : !outcome?.playerIds.length ? "Nobody here" : `${outcome.playerIds.length} ${outcome.playerIds.length === 1 ? "player" : "players"} here` : ["Less loot. Less crowd?", "A little of both.", "Big loot. Big crowd?"][vault.id]}</span></button>;
    })}</div>
    {revealing ? <Reveal room={room}/> : <><div className="grab-bar"><div><span className="eyebrow">{submitted ? "YOU CHOSE" : "YOUR VAULT"}</span><strong>{selected === null ? "Tap one above" : room.targets.find((entry) => entry.id === selected)?.name}</strong><span>{submitted ? "You can’t change a locked choice." : crossActive ? "Your one steal is turned on." : "Share if someone else comes along."}</span></div><button className="button primary grab-button" disabled={!canSubmit} onClick={() => { if (target !== null) void act({ type: "submit", target, doubleCross: steal }); }}>{busy ? <LoaderCircle className="spin" size={19}/> : locked ? <LockKeyhole size={19}/> : <Coins size={19}/>} {locked ? "Choice locked" : crossActive ? "Steal the loot" : "Grab loot"}<ArrowRight size={18}/></button></div><div className={`steal-option ${crossActive ? "steal-active" : ""}`}><button type="button" aria-pressed={crossActive} aria-label="Steal instead using Double Cross" disabled={locked || busy || !me.doubleCrossAvailable} onClick={() => setSteal(!steal)}><Skull size={18}/>{me.doubleCrossAvailable || submitted?.doubleCross ? "Steal instead" : "Steal already used"}<span>{crossActive ? "ON" : "OPTIONAL"}</span></button><p>One Double Cross per game. Two steals at the same vault? Nobody gets loot.</p></div><p className="round-note">{room.players.filter((player) => player.submitted).length} of {room.players.length} choices locked. {room.mode === "practice" ? "Byte has already picked. Now it’s your turn." : "Reveal when everyone chooses or time runs out."}</p></>}
  </div>;
}

function Reveal({ room }: { room: RoomView }) {
  const result = room.history.at(-1)!;
  const mine = result.players.find((entry) => entry.playerId === room.me)!;
  const vault = result.targets.find((entry) => entry.target.id === mine.target);
  const labels = { paid: mine.doubleCross ? "You stole the whole vault!" : "You got the loot!", betrayed: "Someone stole your share!", alarm: "Two steals. One loud alarm!", failed: "No loot this time.", passed: "You missed this round." };
  const explanation = mine.outcome === "passed" ? "Choose a vault before the timer runs out next time." : mine.outcome === "alarm" ? "More than one player used Double Cross here. Nobody gets loot." : mine.outcome === "betrayed" ? "Another player used their one Double Cross at your vault." : mine.doubleCross ? "Your one Double Cross took the entire payout." : vault?.playerIds.length === 1 ? "You had this vault all to yourself." : `You split this vault with ${(vault?.playerIds.length ?? 1) - 1} other ${(vault?.playerIds.length ?? 1) === 2 ? "player" : "players"}.`;
  return <div className="simple-reveal" role="status"><div className={`payout-pop ${mine.earned ? "won-loot" : ""}`}><Coins size={30}/><strong>+{credits(mine.earned ?? 0)}</strong></div><h2>{labels[mine.outcome]}</h2><p>{explanation}</p><p className="next-stage"><ArrowRight size={14}/>{room.round < 4 ? `Next stop: ${stageForRound(room.round + 1).name}` : "Next: everyone’s final loot is revealed."}</p><div className="getaway-players">{result.players.map((entry) => {
    const player = room.players.find((player) => player.id === entry.playerId)!;
    return <div className="getaway-player" key={player.id}>{entry.operative ? <OperativePortrait id={entry.operative}/> : <span className="avatar">?</span>}<div><strong>{player.nickname}{entry.doubleCross && <Skull size={14} aria-label="Used Double Cross"/>}</strong><span>{entry.target === null ? "Didn’t choose" : room.targets.find((target) => target.id === entry.target)?.name}</span></div>{player.id === room.me && <b>{credits(entry.earned ?? 0)}</b>}</div>;
  })}</div></div>;
}

function Finale({ room, busy, act }: { room: RoomView; busy: boolean; act: Act }) {
  const sorted = [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winners = sorted.filter((player) => player.score === sorted[0].score);
  const won = winners.some((player) => player.id === room.me);
  async function again() { if (await act({ type: "rematch" }) && room.mode === "practice") await act({ type: "start" }); }
  return <div className="simple-finale"><Trophy size={42}/><h2>{won ? "You made the biggest getaway!" : `${winners.map((player) => player.nickname).join(" & ")} ${winners.length > 1 ? "win" : "wins"}!`}</h2><p>Four rounds. All the totals are now revealed.</p><VaultScene stage={stageForRound(4)} vaults={[vaultsForRound(4)[2]]} selected={2} open={[2]} disabled/><ol className="final-ranking">{sorted.map((player, index) => <li key={player.id} className={player.id === room.me ? "is-me" : ""}><span>{index > 0 && player.score === sorted[index - 1].score ? sorted.findIndex((entry) => entry.score === player.score) + 1 : index + 1}</span><strong>{player.nickname}{player.id === room.me && <small>YOU</small>}{player.isComputer && <Bot size={16}/>}</strong><b>{credits(player.score ?? 0)}</b></li>)}</ol>{room.hostId === room.me ? <button className="button primary" disabled={busy} onClick={() => void again()}><RotateCcw size={18}/>Play again</button> : <p>The host can start another game.</p>}<Link href="/" className="text-link"><ArrowLeft size={14}/>Back to home</Link></div>;
}

function History({ room }: { room: RoomView }) {
  return <details className="simple-history"><summary>Previous rounds</summary>{room.history.map((result) => {
    const mine = result.players.find((player) => player.playerId === room.me)!;
    return <div key={result.round}><span>Round {result.round}</span><strong>{mine.target === null ? "Skipped" : result.targets.find((entry) => entry.target.id === mine.target)?.target.name}</strong><b>{credits(mine.earned ?? 0)}</b></div>;
  })}</details>;
}
