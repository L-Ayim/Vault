// src/components/ChatBox.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import { QUERY_CHANNEL_MESSAGES, MUTATION_SEND_MESSAGE, SUBSCRIPTION_NODE_UPDATES } from "../graphql/operations";
import { Send, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

interface Message {
  id: string;
  sender: { id: string; username: string };
  text: string | null;
  createdAt: string;
}

interface ChatBoxProps {
  channelId: string;
  onClose: () => void;
}

export default function ChatBox({ channelId, onClose }: ChatBoxProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data, loading, error, refetch } = useQuery<{ channelMessages: Message[] }>(
    QUERY_CHANNEL_MESSAGES,
    {
      variables: { channelId, limit: 50, offset: 0 },
      skip: !channelId,
      fetchPolicy: "network-only",
    }
  );

  // Subscribe to updates and refetch messages when an event arrives
  const { data: subData } = useSubscription(SUBSCRIPTION_NODE_UPDATES);
  useEffect(() => {
    if (subData) refetch();
  }, [subData, refetch]);

  const [sendMessage] = useMutation(MUTATION_SEND_MESSAGE, {
    onCompleted: () => {
      setMessageText("");
      refetch();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.channelMessages]);

  const handleSend = () => {
    if (!channelId || !messageText.trim()) return;
    sendMessage({
      variables: { channelId, text: messageText.trim() },
    });
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Inline helpers:
  function renderText(txt: string): React.ReactNode[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return txt.split(urlRegex).map((chunk, i) =>
      urlRegex.test(chunk) ? (
        <a
          key={i}
          href={chunk}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline"
        >
          {chunk}
        </a>
      ) : (
        <span key={i}>{chunk}</span>
      )
    );
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-neutral-800/90 rounded-lg shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b border-neutral-700">
        <h4 className="text-white text-sm">Chat</h4>
        <button onClick={onClose} className="p-1 hover:bg-neutral-700 rounded">
          <X className="text-white" size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-500 text-sm">Error: {error.message}</p>
        ) : data?.channelMessages.length ? (
          data.channelMessages.map((m) => {
            const mine = m.sender.id === userId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    mine ? "bg-orange-500 text-white" : "bg-neutral-700 text-gray-100"
                  }`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {m.sender.username}
                  </div>
                  <div className="text-xs text-gray-400 text-right mb-1">
                    {formatTime(m.createdAt)}
                  </div>
                  {m.text && <div>{renderText(m.text)}</div>}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-400 text-sm">No messages yet.</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-neutral-700 flex space-x-2">
        <textarea
          rows={1}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!channelId}
          className="flex-1 px-2 py-1 bg-neutral-700 rounded-md text-sm text-white resize-none focus:outline-none disabled:opacity-50"
          placeholder="Type a message…"
        />
        <button
          onClick={handleSend}
          disabled={!channelId}
          className="p-2 bg-orange-500 hover:bg-orange-600 rounded-md focus:outline-none disabled:opacity-50 text-white"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
