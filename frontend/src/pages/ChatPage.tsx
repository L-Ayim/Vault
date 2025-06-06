// src/pages/ChatPage.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  QUERY_FRIENDS,
  QUERY_MY_CHANNELS,
  QUERY_CHANNEL_MESSAGES,
  QUERY_MY_NODES,
  MUTATION_CREATE_DIRECT_CHANNEL,
  MUTATION_SEND_MESSAGE,
  MUTATION_JOIN_NODE_CHANNEL,
  MUTATION_CREATE_FRIEND_INVITE,
  MUTATION_REDEEM_FRIEND_INVITE,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";
import { FilePlus, Send, Users, MessageCircle, Search, Link2 } from "lucide-react";

interface Friend {
  id: string;
  username: string;
}
interface QueryFriendsResult {
  friends: Friend[];
}

interface Channel {
  id: string;
  name: string;
  channelType: string;
  node: { id: string; name: string } | null;
  createdAt: string;
}
interface QueryMyChannelsResult {
  myChannels: Channel[];
}

interface Message {
  id: string;
  sender: {
    id: string;
    username: string;
    profile: { avatarUrl: string | null };
  };
  text: string | null;
  attachment: { id: string; uploadUrl: string; note: string | null } | null;
  createdAt: string;
}
interface QueryChannelMessagesResult {
  channelMessages: Message[];
}

interface NodeData {
  id: string;
  name: string;
}
interface QueryMyNodesResult {
  myNodes: NodeData[];
}

export default function ChatPage() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1) Hooks in fixed order
  // ─────────────────────────────────────────────────────────────────────────────

  // 1.a) Page title
  useEffect(() => {
    document.title = "Chat";
  }, []);

  // 1.b) Auth & user info
  const { user, logout } = useAuth();

  // 1.c) Fetch friends for direct chat
  const {
    data: friendsData,
    loading: friendsLoading,
    error: friendsError,
  } = useQuery<QueryFriendsResult>(QUERY_FRIENDS, { variables: { limit: 50, offset: 0 } });

  // 1.d) Fetch my channels
  const {
    data: channelsData,
    loading: channelsLoading,
    error: channelsError,
    refetch: refetchChannels,
  } = useQuery<QueryMyChannelsResult>(QUERY_MY_CHANNELS, {
    fetchPolicy: "network-only",
  });

  // 1.e) Fetch my nodes (for node‐chat list)
  const {
    data: nodesData,
    loading: nodesLoading,
    error: nodesError,
  } = useQuery<QueryMyNodesResult>(QUERY_MY_NODES, {
    fetchPolicy: "network-only",
    variables: { limit: 50, offset: 0 },
  });

  // 1.f) State: selected channel ID
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // 1.g) Fetch messages for selected channel (skip if none)
  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery<QueryChannelMessagesResult>(QUERY_CHANNEL_MESSAGES, {
    variables: { channelId: selectedChannelId || "", limit: 50, offset: 0 },
    skip: !selectedChannelId,
    fetchPolicy: "network-only",
  });

  // 1.h) Message input state and file upload
  const [messageText, setMessageText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  // 1.i) Invite‐link state & redeem code
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");

  // 1.j) Collapsible Node Chats
  const [nodeListOpen, setNodeListOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) Mutations
  // ─────────────────────────────────────────────────────────────────────────────
  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL, {
    onCompleted: () => {
      refetchChannels();
    },
  });
  const [joinNodeChannel] = useMutation(MUTATION_JOIN_NODE_CHANNEL, {
    onCompleted: () => {
      refetchChannels();
    },
  });
  const [sendMessage] = useMutation(MUTATION_SEND_MESSAGE, {
    onCompleted: () => {
      setMessageText("");
      setAttachedFile(null);
      if (selectedChannelId) {
        refetchMessages();
      }
    },
  });
  const [createFriendInvite] = useMutation(MUTATION_CREATE_FRIEND_INVITE, {
    onCompleted: (res) => {
      setInviteCode(res.createFriendInvite.invite.code);
    },
  });
  const [redeemFriendInvite] = useMutation(MUTATION_REDEEM_FRIEND_INVITE, {
    onCompleted: () => {
      refetchChannels();
      setRedeemCode("");
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  // 3.a) Start a direct chat with selected friend
  const handleStartDirectChat = (friendId: string) => {
    createDirectChannel({ variables: { withUserId: friendId } });
  };

  // 3.b) Join a node discussion channel (from list)
  const handleJoinNode = (nodeId: string) => {
    joinNodeChannel({ variables: { nodeId } });
  };

  // 3.c) Select a channel to view
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  // 3.d) Send a new message
  const handleSendMessage = () => {
    if (!selectedChannelId) return;
    if (!messageText.trim() && !attachedFile) return;
    sendMessage({
      variables: {
        channelId: selectedChannelId,
        text: messageText.trim() !== "" ? messageText.trim() : null,
        upload: attachedFile,
      },
    });
  };

  // 3.e) Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  // 3.f) Generate a friend‐invite link (using "SINGLE" instead of "SINGLE_USE")
  const handleGenerateInvite = () => {
    createFriendInvite({ variables: { codeType: "SINGLE", maxUses: 1 } });
  };

  // 3.g) Redeem a friend invite code
  const handleRedeemInvite = () => {
    if (!redeemCode.trim()) return;
    redeemFriendInvite({ variables: { code: redeemCode.trim() } });
  };

  // 3.h) Format timestamp
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4) Early returns after hooks
  // ─────────────────────────────────────────────────────────────────────────────
  if (friendsLoading || channelsLoading || nodesLoading) return <div>Loading chat…</div>;
  if (friendsError) return <div>Error loading friends: {friendsError.message}</div>;
  if (channelsError) return <div>Error loading channels: {channelsError.message}</div>;
  if (nodesError) return <div>Error loading nodes: {nodesError.message}</div>;

  // ─────────────────────────────────────────────────────────────────────────────
  // 5) Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      {/* ───────────────────── Sidebar ───────────────────── */}
      <aside className="w-80 bg-neutral-800/75 backdrop-blur-sm p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-extrabold">
            <span className="text-red-500">V</span>
            <span className="text-white">ault</span>
          </div>
        </div>

        {/* Friends List */}
        <h2 className="text-xl font-semibold mb-2 flex items-center">
          <Users className="inline-block mr-2 text-orange-500" />
          Friends
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {friendsData?.friends.length ? (
            friendsData.friends.map((f) => (
              <button
                key={f.id}
                onClick={() => handleStartDirectChat(f.id)}
                className="w-full text-left px-3 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 transition-colors text-sm"
              >
                {f.username}
              </button>
            ))
          ) : (
            <div className="text-gray-400 text-sm">No friends found.</div>
          )}
        </div>

        {/* Invite Link Generator */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Link2 className="inline-block mr-1 text-orange-500" />
            Invite Friend
          </h3>
          <button
            onClick={handleGenerateInvite}
            className="w-full flex items-center justify-center px-3 py-2 bg-orange-500 rounded-md hover:bg-red-600 transition-colors text-sm"
          >
            Generate Link
          </button>
          {inviteCode && (
            <div className="mt-2">
              <label htmlFor="invite-code-display" className="sr-only">
                Invite Code
              </label>
              <input
                id="invite-code-display"
                type="text"
                readOnly
                value={inviteCode}
                className="
                  w-full
                  mt-2
                  px-3 py-2
                  bg-neutral-700 text-white
                  border border-neutral-600
                  rounded-md
                  focus:outline-none focus:ring-2 focus:ring-orange-500
                  text-sm
                "
              />
            </div>
          )}
        </div>

        {/* Redeem Invite */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Search className="inline-block mr-1 text-orange-500" />
            Redeem Invite
          </h3>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Invite code"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 px-2 py-1 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
            <button
              onClick={handleRedeemInvite}
              className="px-3 py-1 bg-orange-500 rounded-md hover:bg-red-600 transition-colors text-sm"
            >
              Join
            </button>
          </div>
        </div>

        {/* My Channels */}
        <h2 className="text-xl font-semibold mb-2 flex items-center">
          <MessageCircle className="inline-block mr-2 text-orange-500" />
          My Channels
        </h2>
        <div className="flex-1 overflow-y-auto mb-6">
          {channelsData?.myChannels.length ? (
            channelsData.myChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelectChannel(ch.id)}
                className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors ${
                  ch.id === selectedChannelId
                    ? "bg-orange-600"
                    : "bg-neutral-700 hover:bg-neutral-600"
                } text-sm`}
              >
                {ch.name}{" "}
                {ch.channelType === "NODE" && ch.node ? `(Node: ${ch.node.name})` : ""}
              </button>
            ))
          ) : (
            <div className="text-gray-400 text-sm">No channels available.</div>
          )}
        </div>

        {/* Collapsible Node Chats */}
        <div className="mb-4">
          <button
            onClick={() => setNodeListOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 transition-colors text-sm font-medium"
          >
            <span className="flex items-center">
              <MessageCircle className="inline-block mr-2 text-orange-500" />
              Node Chats
            </span>
            <span>{nodeListOpen ? "▾" : "▸"}</span>
          </button>
          {nodeListOpen && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {nodesData?.myNodes.length ? (
                nodesData.myNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleJoinNode(node.id)}
                    className="w-full text-left px-3 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600 transition-colors text-sm"
                  >
                    {node.name}
                  </button>
                ))
              ) : (
                <div className="text-gray-400 text-sm">No nodes found.</div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ───────────────────── Chat Area ───────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
          <div className="text-2xl font-extrabold">
            {selectedChannelId
              ? channelsData?.myChannels.find((c) => c.id === selectedChannelId)?.name
              : ""}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-200 font-medium">{user?.username}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-orange-500 text-white rounded-md font-medium hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {selectedChannelId ? (
            messagesLoading ? (
              <div>Loading messages…</div>
            ) : messagesError ? (
              <div>Error loading messages: {messagesError.message}</div>
            ) : messagesData?.channelMessages.length ? (
              messagesData.channelMessages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{m.sender.username}</span>
                    <span className="text-gray-400 text-xs">{formatTime(m.createdAt)}</span>
                  </div>
                  {m.text && (
                    <div className="bg-neutral-700 px-3 py-2 rounded-md text-sm">{m.text}</div>
                  )}
                  {m.attachment && (
                    <div>
                      <a
                        href={m.attachment.uploadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-orange-400 hover:text-red-500"
                      >
                        <FilePlus size={14} />
                        <span className="text-sm">
                          {m.attachment.note || "Download file"}
                        </span>
                      </a>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-400">No messages yet.</div>
            )
          ) : (
            <div className="text-gray-400">Select a channel to view messages.</div>
          )}
        </div>

        {/* Input area */}
        <div className="bg-neutral-800/75 backdrop-blur-sm px-6 py-4 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Type a message…"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={!selectedChannelId}
            className="flex-1 px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm disabled:opacity-50"
          />

          {/* Paperclip‐only file picker */}
          <label
            htmlFor="file-input"
            className={`p-2 rounded-md hover:bg-neutral-700 transition-colors cursor-pointer ${
              !selectedChannelId ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <FilePlus size={18} className="text-white" />
          </label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            disabled={!selectedChannelId}
            className="hidden"
          />

          <button
            onClick={handleSendMessage}
            disabled={!selectedChannelId}
            className="p-2 bg-orange-500 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </main>
    </div>
  );
}
