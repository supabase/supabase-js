"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUsername } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ROOMS = ["general", "random", "tech", "off-topic"] as const;
type Room = (typeof ROOMS)[number];

interface Message {
  id: string;
  room: string;
  username: string;
  content: string;
  created_at: string;
}

interface PresenceState {
  username: string;
}

export function Chat() {
  const [room, setRoom] = useState<Room>("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Get username on mount
  useEffect(() => {
    setUsername(getUsername());
  }, []);

  // Subscribe to room changes
  useEffect(() => {
    if (!username) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Fetch existing messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("room", room)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data) setMessages(data);
    };

    fetchMessages();

    // Subscribe to new messages and presence
    const channel = supabase
      .channel(`room:${room}`)
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as Message]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, username, supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current) return;

    const message: Message = {
      id: crypto.randomUUID(),
      room,
      username,
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    // Broadcast to other clients
    channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });

    // Add to local state immediately
    setMessages((prev) => [...prev, message]);

    // Persist to database
    await supabase.from("messages").insert(message);

    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Realtime Chat</h1>
        <p className="text-muted-foreground text-sm">
          Chatting as <span className="font-medium text-foreground">{username}</span>
        </p>
      </div>

      {/* Room Tabs */}
      <div className="flex gap-2 mb-4">
        {ROOMS.map((r) => (
          <Button
            key={r}
            variant={room === r ? "default" : "outline"}
            size="sm"
            onClick={() => setRoom(r)}
            className="capitalize"
          >
            {r}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Messages */}
        <Card className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    msg.username === username && "items-end"
                  )}
                >
                  <span className="text-xs text-muted-foreground mb-1">
                    {msg.username}
                  </span>
                  <div
                    className={cn(
                      "px-3 py-2 rounded-lg max-w-[80%]",
                      msg.username === username
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim()}>
              Send
            </Button>
          </form>
        </Card>

        {/* Online Users */}
        <Card className="w-48 p-4 hidden md:block">
          <h3 className="font-medium mb-3">
            Online ({onlineUsers.length})
          </h3>
          <ul className="space-y-2">
            {onlineUsers.map((user, i) => (
              <li
                key={`${user.username}-${i}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className={cn(user.username === username && "font-medium")}>
                  {user.username}
                  {user.username === username && " (you)"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
