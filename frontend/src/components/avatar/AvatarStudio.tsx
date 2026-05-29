"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Wifi, Volume2, Send } from "lucide-react";
import { createClient } from "@anam-ai/js-sdk";
import { cn } from "@/lib/utils";
import {
  getAvatarSettings, getAvatarSession, listPersonas,
  updateAvatarPersona, type AvatarPersonaId, type AvatarPersonaMeta,
} from "@/lib/avatar-api";
import { createChat, sendChatMessage } from "@/lib/chat-api";
import { synthesizeSpeech, playBase64Audio } from "@/lib/voice-api";

type AvatarState = "idle" | "connecting" | "live" | "speaking" | "thinking" | "listening";

interface Message { role: "ai" | "user"; text: string; time: string; }

const stateConfig: Record<AvatarState, { dot: string; label: string; wave: boolean }> = {
  idle:       { dot: "bg-zinc-400",                        label: "Ready",                 wave: false },
  connecting: { dot: "bg-amber-400 animate-pulse",         label: "Connecting...",         wave: false },
  live:       { dot: "bg-emerald-400",                     label: "Live avatar connected", wave: false },
  speaking:   { dot: "bg-blue-400 animate-pulse",          label: "Speaking...",           wave: true  },
  thinking:   { dot: "bg-violet-400 animate-pulse",        label: "Thinking...",           wave: false },
  listening:  { dot: "bg-red-400 animate-pulse",           label: "Listening...",          wave: false },
};

function now() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function AvatarStudio() {
  const videoElementId = "anam-video";

  const [personas, setPersonas]         = useState<AvatarPersonaMeta[]>([]);
  const [selected, setSelected]         = useState<AvatarPersonaId>("govinda");
  const [loading, setLoading]           = useState(true);
  const [avatarState, setAvatarState]   = useState<AvatarState>("idle");
  const [messages, setMessages]         = useState<Message[]>([{
    role: "ai",
    text: "Namaste! Main Govinda hoon. How can I help you today? Type or use the mic to speak.",
    time: now(),
  }]);
  const [input, setInput]               = useState("");
  const [isTyping, setIsTyping]         = useState(false);
  const [listening, setListening]       = useState(false);
  const [avatarChatId, setAvatarChatId] = useState<string | null>(null);
  const [anamClient, setAnamClient]     = useState<any>(null);
  const [isStreaming, setIsStreaming]   = useState(false);

  // FIX 3: Track "pending stream" separately so video is visible before SDK attaches
  const [videoVisible, setVideoVisible] = useState(false);

  const anamClientRef  = useRef<any>(null);
  const msgsEndRef     = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  function addMessage(role: "ai" | "user", text: string) {
    setMessages((prev) => [...prev, { role, text, time: now() }]);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, settings] = await Promise.all([listPersonas(), getAvatarSettings()]);
      setPersonas(list);
      setSelected(settings.persona);
    } catch {
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { anamClientRef.current = anamClient; }, [anamClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        anamClientRef.current?.stopStreaming?.();
        anamClientRef.current?.disconnect?.();
        anamClientRef.current?.destroy?.();
      } catch {}
    };
  }, []);

  // FIX 4: Fully tear down old client and null out refs before reconnecting
  async function teardownAnamClient() {
    try {
      anamClientRef.current?.stopStreaming?.();
      await anamClientRef.current?.disconnect?.();
      await anamClientRef.current?.destroy?.();
    } catch {}
    anamClientRef.current = null;
    setAnamClient(null);
    setIsStreaming(false);
    setVideoVisible(false);
  }

  async function selectPersona(id: AvatarPersonaId) {
    setSelected(id);
    await updateAvatarPersona(id);
    await teardownAnamClient();
    const greeting = id === "govinda"
      ? "Namaste! Main Govinda hoon. Aap kaise help kar sakta hoon?"
      : "Namaste! Main Durga hoon. Aapki kya madad kar sakti hoon?";
    setMessages([{ role: "ai", text: greeting, time: now() }]);
    setAvatarState("idle");
  }

  async function prepareStream() {
    setAvatarState("connecting");
    await teardownAnamClient();

    // FIX 3: Make video visible (opacity, not display:none) BEFORE SDK attaches
    setVideoVisible(true);

    try {
      const data = await getAvatarSession();

      if (data.mode === "anam") {
        const sessionToken = data.sessionToken ?? data.token;
        if (!sessionToken) throw new Error("Session token missing");

        // Poll for video element — it should now be visible (not hidden)
        let videoEl: HTMLElement | null = null;
        for (let i = 0; i < 10; i++) {
          videoEl = document.getElementById(videoElementId);
          if (videoEl) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        if (!videoEl) throw new Error("Video element not found after waiting");

        const client = createClient(sessionToken);
        await client.streamToVideoElement(videoElementId);

        setAnamClient(client);
        anamClientRef.current = client;
        setIsStreaming(true);
        setAvatarState("live");
        addMessage("ai", `Live avatar connected — ${data.avatar.name}. You can see and hear me in real time now.`);
      } else {
        setVideoVisible(false);
        setAvatarState("idle");
        addMessage("ai", data.reason ?? "Using static avatar mode with voice.");
      }
    } catch (err) {
      setVideoVisible(false);
      setAvatarState("idle");
      addMessage("ai", err instanceof Error ? err.message : "Connection failed. Try again.");
    }
  }

  async function askAiAndSpeak(prompt: string) {
    setAvatarState("thinking");
    setIsTyping(true);
    try {
      let chatId = avatarChatId;
      if (!chatId) {
        const chat = await createChat("Avatar Voice Session");
        chatId = chat.id;
        setAvatarChatId(chat.id);
      }
      const result = await sendChatMessage(chatId, prompt);
      const reply =
        result.assistantMessage?.content ||
        result.chat.messages.filter((m: any) => m.role === "assistant").at(-1)?.content || "";

      if (!reply) { setAvatarState("idle"); setIsTyping(false); return; }

      setIsTyping(false);
      addMessage("ai", reply);
      setAvatarState("speaking");

      if (isStreaming && anamClientRef.current) {
        await anamClientRef.current.talk(reply);
      } else {
        const audio = await synthesizeSpeech(reply);
        await playBase64Audio(audio.audioBase64, audio.contentType);
      }
    } catch (err) {
      addMessage("ai", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAvatarState("idle");
      setIsTyping(false);
    }
  }

  async function speakSample() {
    const text = selected === "govinda"
      ? "Namaste! Main Govinda hoon, RKG Labs ka aapka apna AI assistant."
      : "Namaste! Main Durga hoon, RKG Labs ki AI care assistant.";
    setAvatarState("speaking");
    try {
      if (isStreaming && anamClientRef.current) {
        await anamClientRef.current.talk(text);
      } else {
        const audio = await synthesizeSpeech(text);
        await playBase64Audio(audio.audioBase64, audio.contentType);
      }
    } catch {}
    setAvatarState("idle");
  }

  function toggleListen() {
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addMessage("ai", "Speech recognition is not supported in this browser."); return; }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setAvatarState("idle");
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const spoken = e.results[0][0].transcript;
      addMessage("user", spoken);
      void askAiAndSpeak(spoken);
      setListening(false);
    };
    rec.onerror = () => { setListening(false); setAvatarState("idle"); };
    rec.onend   = () => { setListening(false); };
    setListening(true);
    setAvatarState("listening");
    rec.start();
  }

  function handleSend() {
    const text = input.trim();
    if (!text || avatarState === "thinking" || avatarState === "speaking") return;
    setInput("");
    addMessage("user", text);
    void askAiAndSpeak(text);
  }

  const state   = stateConfig[avatarState];
  const persona = personas.find((p) => p.id === selected);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex rounded-2xl border border-border/60 overflow-hidden" style={{ height: "620px" }}>

      {/* ── LEFT: Avatar panel ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-border/60">

        {/* Avatar viewport */}
        <div
          className="flex-1 relative overflow-hidden flex items-end"
          style={{ background: selected === "govinda" ? "#0a0f1e" : "#0f0a1e" }}
        >
          {/*
            FIX 3: Use opacity/pointer-events instead of `hidden` (display:none).
            The Anam SDK needs the <video> element to be in the layout tree when
            streamToVideoElement() is called. `hidden` removes it from layout;
            opacity-0 keeps it mounted and measurable.
          */}
          <video
            id={videoElementId}
            autoPlay
            playsInline
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              videoVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />

          {/* Static avatar — shown when not streaming */}
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn(
                "relative w-36 h-36 rounded-full flex items-center justify-center",
                "border-2 border-white/10",
                selected === "govinda" ? "bg-blue-900/40" : "bg-violet-900/40",
              )}>
                <div className={cn(
                  "absolute -inset-4 rounded-full border border-white/10",
                  avatarState === "speaking"  && "animate-ping",
                  avatarState === "listening" && "animate-ping [animation-duration:0.7s]",
                )} />
                <div className="absolute -inset-8 rounded-full border border-white/5" />
                <img
                  src={`/api/avatar-image/${selected}`}
                  alt={persona?.name ?? selected}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>
          )}

          {/* Overlay info */}
          <div
            className="relative w-full p-4"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
          >
            <p className="text-white font-medium text-[15px]">{persona?.name ?? selected}</p>
            <p className="text-white/50 text-[11px] mt-0.5">{persona?.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", state.dot)} />
              <span className="text-white/40 text-[11px]">{state.label}</span>
              {state.wave && (
                <div className="flex items-end gap-0.5 h-3">
                  {[0, 0.1, 0.2, 0.15, 0.05].map((d, i) => (
                    <div
                      key={i}
                      className="w-0.5 rounded-full bg-blue-400"
                      style={{ height: "100%", animation: `wave 0.8s ${d}s ease-in-out infinite` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Persona selector */}
        <div className="flex border-t border-border/60">
          {(personas.length > 0 ? personas : [
            { id: "govinda", name: "Govinda" },
            { id: "durga",   name: "Durga" },
          ] as any[]).map((p) => (
            <button
              key={p.id}
              onClick={() => selectPersona(p.id as AvatarPersonaId)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors border-b-2",
                selected === p.id
                  ? p.id === "govinda"
                    ? "text-blue-700 dark:text-blue-300 border-blue-400 bg-blue-50 dark:bg-blue-950"
                    : "text-violet-700 dark:text-violet-300 border-violet-400 bg-violet-50 dark:bg-violet-950"
                  : "text-muted-foreground border-transparent hover:bg-muted/60"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Chat panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium">{persona?.name ?? selected}</p>
            <p className="text-[11px] text-muted-foreground">Voice + text · English & Hindi</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={prepareStream}
              disabled={avatarState === "connecting"}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {avatarState === "connecting"
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Wifi className="w-3 h-3" />}
              {avatarState === "connecting" ? "Connecting..." : "Connect live"}
            </button>
            <button
              onClick={speakSample}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted/60"
            >
              <Volume2 className="w-3 h-3" /> Hear voice
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2 items-end", msg.role === "user" && "flex-row-reverse")}>
              {msg.role === "ai" && (
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: selected === "govinda" ? "#0a0f1e" : "#0f0a1e" }}
                >
                  <span className="text-white/60 text-[10px]">AI</span>
                </div>
              )}
              <div className={cn("max-w-[75%]", msg.role === "user" && "items-end flex flex-col")}>
                <div className={cn(
                  "px-3 py-2 rounded-2xl text-[13px] leading-relaxed",
                  msg.role === "ai"
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 rounded-br-sm"
                )}>
                  {msg.text}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1 px-1">{msg.time}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2 items-end">
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: selected === "govinda" ? "#0a0f1e" : "#0f0a1e" }}
              >
                <span className="text-white/60 text-[10px]">AI</span>
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                {[0, 0.2, 0.4].map((d, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                    style={{ animation: `bounce 0.9s ${d}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={msgsEndRef} />
        </div>

        {/* Input row */}
        <div className="px-3 py-3 border-t border-border/60 flex items-center gap-2">
          <button
            onClick={toggleListen}
            aria-label="Toggle microphone"
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors",
              listening
                ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                : "border-border text-muted-foreground hover:bg-muted/60"
            )}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-muted/50 border border-border/60 rounded-full px-4 py-2 text-sm outline-none focus:border-border focus:bg-background transition-colors"
          />

          <button
            onClick={handleSend}
            aria-label="Send message"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes wave   { 0%,100%{height:30%} 50%{height:100%} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}