// src/pages/ChatPage.tsx

"use client";

import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  QUERY_FRIENDS,
  QUERY_CHANNEL_MESSAGES,
  MUTATION_CREATE_DIRECT_CHANNEL,
  MUTATION_SEND_MESSAGE,
  MUTATION_CREATE_FRIEND_INVITE,
  MUTATION_REDEEM_FRIEND_INVITE,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  Link2,
  Clipboard,
  Search,
  FilePlus,
  Send,
} from "lucide-react";

interface Friend { id: string; username: string; }
interface QueryFriendsResult { friends: Friend[]; }

interface Message {
  id: string;
  sender: { id: string; username: string; profile: { avatarUrl: string | null } };
  text: string | null;
  attachment:
    | { id: string; uploadUrl: string; note: string | null; createdAt: string }
    | null;
  createdAt: string;
}
interface QueryChannelMessagesResult { channelMessages: Message[]; }

export default function ChatPage() {
  // Page title
  useEffect(() => { document.title = "Chat"; }, []);

  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // DM state
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState<string>("");

  // Friends list
  const { data: friendsData, loading: friendsLoading, error: friendsError, refetch: refetchFriends } =
    useQuery<QueryFriendsResult>(QUERY_FRIENDS, { variables: { limit: 50, offset: 0 }, pollInterval: 1000 });

  // Messages
  const { data: messagesData, loading: messagesLoading, error: messagesError, refetch: refetchMessages } =
    useQuery<QueryChannelMessagesResult>(QUERY_CHANNEL_MESSAGES, {
      variables: { channelId: selectedChannelId || "", limit: 50, offset: 0 },
      skip: !selectedChannelId,
      fetchPolicy: "network-only",
      pollInterval: 2000,
    });

  // UI state
  const [messageText, setMessageText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mutations
  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL, {
    onCompleted: ({ createDirectChannel }) => {
      const ch = createDirectChannel.channel;
      setSelectedChannelId(ch.id);
      setSelectedChannelName(ch.name);
      setMessageText("");
      setAttachedFile(null);
    },
  });
  const [sendMessage] = useMutation(MUTATION_SEND_MESSAGE, {
    onCompleted: () => {
      setMessageText("");
      setAttachedFile(null);
      setError(null);
      if (selectedChannelId) refetchMessages();
    },
    onError: () => setError("Failed to send. Please try again."),
  });
  const [createFriendInvite] = useMutation(MUTATION_CREATE_FRIEND_INVITE, {
    onCompleted: (res) => setInviteCode(res.createFriendInvite.invite.code),
  });
  const [redeemFriendInvite, { loading: redeeming, error: redeemError }] =
    useMutation(MUTATION_REDEEM_FRIEND_INVITE, {
      onCompleted: (res) => {
        const friendId = res.redeemFriendInvite.friend.id;
        refetchFriends();
        createDirectChannel({ variables: { withUserId: friendId } });
        setRedeemCode("");
        createFriendInvite({ variables: { codeType: "SINGLE", maxUses: 1 } });
        navigate("/chat", { replace: true });
      },
    });

  // Auto-redeem from URL
  useEffect(() => {
    const code = searchParams.get("invite");
    if (code) {
      let raw = code;
      try { raw = new URL(code).searchParams.get("invite") || code; } catch {}
      redeemFriendInvite({ variables: { code: raw } });
    }
  }, [searchParams]);

  // Generate initial invite
  useEffect(() => {
    createFriendInvite({ variables: { codeType: "SINGLE", maxUses: 1 } });
  }, []);

  // Handlers
  const handleStartDM = (friendId: string, friendName: string) => {
    createDirectChannel({ variables: { withUserId: friendId } });
    setSelectedChannelName(friendName);
  };
  const handleSend = () => {
    if (!selectedChannelId) return;
    if (!messageText.trim() && !attachedFile) return;
    sendMessage({
      variables: {
        channelId: selectedChannelId,
        text: messageText.trim() || null,
        upload: attachedFile,
      },
    });
  };
  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAttachedFile(e.target.files?.[0] || null);
  const handleCopyInviteLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/chat?invite=${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.channelMessages]);

  // Helpers
  const formatTime = (iso: string) => new Date(iso).toLocaleString();
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  function renderTextWithLinks(text: string) {
    return text.split(urlRegex).map((chunk, i) =>
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

  if (friendsLoading) return <div>Loading friends…</div>;
  if (friendsError) return <div>Error: {friendsError.message}</div>;

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      {/* Sidebar */}
      <aside className="w-80 bg-neutral-800/75 backdrop-blur-sm p-4 flex flex-col">
        <h1 className="text-2xl font-extrabold mb-4">
          <span className="text-red-500">V</span>ault
        </h1>
        <h2 className="text-xl font-semibold mb-2 flex items-center">
          <Users className="mr-2 text-orange-500" /> Friends
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {friendsData!.friends.length ? (
            friendsData!.friends.map((f) => (
              <button
                key={f.id}
                onClick={() => handleStartDM(f.id, f.username)}
                className="w-full text-left px-3 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 text-sm"
              >
                {f.username}
              </button>
            ))
          ) : (
            <div className="text-gray-400 text-sm">No friends yet.</div>
          )}
        </div>

        {/* Invite */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Link2 className="mr-1 text-orange-500" /> Invite Friend
          </h3>
          {inviteCode && (
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={copied ? "Copied!" : `${window.location.origin}/chat?invite=${inviteCode}`}
                className="flex-1 px-3 py-2 bg-neutral-700 rounded-md text-sm"
              />
              <button
                onClick={handleCopyInviteLink}
                className={`px-3 py-2 rounded-md transition-colors ${
                  copied ? "bg-red-600" : "bg-orange-500 hover:bg-red-600"
                }`}
              >
                <Clipboard size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Redeem */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Search className="mr-1 text-orange-500" /> Redeem Invite
          </h3>
          <div className="flex space-x-2 mb-1">
            <input
              type="text"
              placeholder="Code or full link"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 px-2 py-1 bg-neutral-700 rounded-md text-sm"
            />
            <button
              onClick={() =>
                redeemFriendInvite({
                  variables: { code: redeemCode.trim().replace(/.*invite=/, "") },
                })
              }
              disabled={redeeming}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                redeeming
                  ? "bg-neutral-600 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-red-600"
              }`}
            >
              {redeeming ? "Joining…" : "Join"}
            </button>
          </div>
          {redeemError && (
            <p className="text-red-400 text-sm">{redeemError.message}</p>
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
          <h2 className="text-2xl font-extrabold">{selectedChannelName}</h2>
          <div className="flex items-center space-x-4">
            <span className="text-gray-200">{user?.username}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-orange-500 rounded-md hover:bg-red-600 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {selectedChannelId ? (
            messagesLoading ? (
              <div>Loading messages…</div>
            ) : messagesError ? (
              <div>Error: {messagesError!.message}</div>
            ) : messagesData!.channelMessages.length ? (
              messagesData!.channelMessages.map((m) => {
                const isMine = m.sender.id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`
                        max-w-[75%] px-3 py-2 rounded-2xl text-sm
                        ${isMine
                          ? "bg-neutral-700 text-white"
                          : "bg-neutral-600 text-gray-200"}
                      `}
                    >
                      <div className="text-xs text-gray-400 text-right mb-1">
                        {formatTime(m.createdAt)}
                      </div>
                      {m.text && (
                        <div className="break-words">
                          {renderTextWithLinks(m.text)}
                        </div>
                      )}
                      {m.attachment && (
                        <a
                          href={m.attachment.uploadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center space-x-1 text-xs underline"
                        >
                          <FilePlus size={12} />
                          <span>{m.attachment.note || "Download file"}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-400">No messages yet.</div>
            )
          ) : (
            <div className="text-gray-400">Click a friend to start a DM.</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-neutral-800/75 backdrop-blur-sm px-6 py-4 flex items-start space-x-2">
          <textarea
            rows={1}
            placeholder="Type a message…"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedChannelId}
            className="flex-1 px-3 py-2 bg-neutral-700 rounded-md text-sm resize-none disabled:opacity-50"
          />
          <label
            htmlFor="file-input"
            className={`p-2 rounded-md hover:bg-neutral-700 ${
              !selectedChannelId ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <FilePlus size={18} />
          </label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            disabled={!selectedChannelId}
            className="hidden"
          />
          <button
            onClick={handleSend}
            disabled={!selectedChannelId}
            className="p-2 bg-orange-500 rounded-md hover:bg-red-600 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <p className="text-red-400 text-center text-sm mb-2">{error}</p>
        )}
      </main>
    </div>
  );
}
