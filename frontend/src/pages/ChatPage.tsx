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
import Header from "../components/Header";
import {
  Users,
  Clipboard,
  Search,
  Send,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

interface Friend { id: string; username: string }
interface Message {
  id: string
  sender: { id: string; username: string }
  text: string | null
  createdAt: string
}

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // panel open state
  const [panelOpen, setPanelOpen] = useState(true);

  // chat UI state
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [copiedFriend, setCopiedFriend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { document.title = "Chat" }, []);

  const { data: friendsData, loading: friendsLoading, error: friendsError, refetch: refetchFriends } =
    useQuery<{ friends: Friend[] }>(QUERY_FRIENDS, { variables:{ limit:50, offset:0 }, pollInterval:1000 });

  const { data: messagesData, loading: messagesLoading, error: messagesError, refetch: refetchMessages } =
    useQuery<{ channelMessages: Message[] }>(QUERY_CHANNEL_MESSAGES, {
      variables:{ channelId:selectedChannelId||"", limit:50, offset:0 },
      skip: !selectedChannelId,
      fetchPolicy:"network-only",
      pollInterval:2000,
    });

  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL, {
    onCompleted: ({ createDirectChannel }) => {
      setSelectedChannelId(createDirectChannel.channel.id);
      setMessageText("");
      setPanelOpen(false);
    },
  });

  const [sendMessage] = useMutation(MUTATION_SEND_MESSAGE, {
    onCompleted: () => {
      setMessageText("");
      setError(null);
      selectedChannelId && refetchMessages();
    },
    onError: () => setError("Failed to send. Please try again."),
  });

  const [createFriendInvite] = useMutation(MUTATION_CREATE_FRIEND_INVITE, {
    onCompleted: res => setInviteCode(res.createFriendInvite.invite.code),
  });

  const [redeemFriendInvite, { loading: redeeming, error: redeemError }] =
    useMutation(MUTATION_REDEEM_FRIEND_INVITE, {
      onCompleted: res => {
        const fid = res.redeemFriendInvite.friend.id;
        selectFriend(fid);
        refetchFriends();
        setRedeemCode("");
        createFriendInvite({ variables:{ codeType:"SINGLE", maxUses:1 } });
        navigate("/chat",{ replace:true });
        setPanelOpen(false);
      },
    });

  useEffect(() => {
    const f = searchParams.get("invite");
    if (f) {
      let raw = f;
      try { raw = new URL(f).searchParams.get("invite")||f } catch {}
      redeemFriendInvite({ variables:{ code:raw } });
    }
  }, [searchParams]);

  useEffect(() => {
    createFriendInvite({ variables:{ codeType:"SINGLE", maxUses:1 } });
  }, []);

  useEffect(
    () => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }) },
    [messagesData?.channelMessages]
  );

  function selectFriend(id:string){
    if(selectedFriendId===id){
      setSelectedFriendId(null);
      setSelectedChannelId(null);
    } else {
      setSelectedFriendId(id);
      createDirectChannel({ variables:{ withUserId:id }});
    }
  }

  const handleSendClick = () => {
    if(!selectedChannelId||!messageText.trim()) return;
    sendMessage({ variables:{ channelId:selectedChannelId, text:messageText.trim() }});
  };

  const handleKeyDown:React.KeyboardEventHandler = e => {
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault(); handleSendClick();
    }
  };

  const handleCopyFriend = () => {
    if(!inviteCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/chat?invite=${inviteCode}`)
      .then(()=>{ setCopiedFriend(true); setTimeout(()=>setCopiedFriend(false),2000) });
  };

  if(friendsLoading) return <div className="p-4">Loading…</div>;
  if(friendsError)  return <div className="p-4">Error loading friends</div>;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">

      {/* Header */}
      <Header />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">

        {/* Friends Panel */}
        {panelOpen && (
          <aside className="w-full sm:w-80 bg-neutral-800/75 p-4 flex-shrink-0 flex flex-col backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Friends</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1">
                <ChevronLeft className="text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {friendsData!.friends.length ? (
                friendsData!.friends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => selectFriend(f.id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-md focus:outline-none
                      ${selectedFriendId === f.id
                        ? "bg-red-600"
                        : "bg-orange-500 hover:bg-orange-600"}
                    `}
                  >
                    {f.username}
                  </button>
                ))
              ) : (
                <p className="text-gray-400 text-sm">No friends available.</p>
              )}
            </div>

            <details className="mt-4 border-t border-neutral-700 pt-4">
              <summary className="cursor-pointer text-sm font-medium flex items-center">
                <Clipboard className="mr-2 text-orange-500" /> Invite / Redeem
              </summary>
              <div className="mt-2 space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    readOnly
                    value={
                      copiedFriend
                        ? "Copied!"
                        : `${window.location.origin}/chat?invite=${inviteCode}`
                    }
                    className="flex-1 px-3 py-2 bg-neutral-700 rounded-md text-sm"
                  />
                  <button
                    onClick={handleCopyFriend}
                    className={`
                      p-2 rounded
                      ${copiedFriend
                        ? "bg-red-600"
                        : "bg-orange-500 hover:bg-orange-600"}
                    `}
                  >
                    <Clipboard size={16} />
                  </button>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Paste invite link or code"
                    value={redeemCode}
                    onChange={e => setRedeemCode(e.target.value)}
                    className="flex-1 px-2 py-1 bg-neutral-700 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const code = redeemCode.trim().replace(/.*invite=/, "");
                      redeemFriendInvite({ variables:{ code } });
                      setRedeemCode("");
                    }}
                    disabled={redeeming}
                    className={`
                      px-3 py-1 rounded
                      ${redeeming
                        ? "bg-neutral-600"
                        : "bg-orange-500 hover:bg-orange-600"}
                    `}
                  >
                    {redeeming ? "Joining…" : "Join"}
                  </button>
                </div>
                {redeemError && (
                  <p className="text-red-400 text-sm">{redeemError.message}</p>
                )}
              </div>
            </details>
          </aside>
        )}

        {/* Chat Area */}
        <main className="flex-1 flex flex-col">
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="p-2 m-4 self-start bg-neutral-800/75 rounded-md"
            >
              <ChevronRight className="text-white" />
            </button>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!selectedChannelId && (
              <div className="text-gray-400">Select a friend to start chatting.</div>
            )}
            {selectedChannelId && messagesLoading && <div>Loading…</div>}
            {selectedChannelId && messagesError && (
              <div>Error: {messagesError.message}</div>
            )}
            {selectedChannelId && !messagesLoading && !messagesError && (
              messagesData!.channelMessages.length ? (
                messagesData!.channelMessages.map(m => {
                  const mine = m.sender.id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                          mine ? "bg-neutral-700" : "bg-neutral-600"
                        }`}
                      >
                        <div className="text-xs font-semibold mb-1">{m.sender.username}</div>
                        <div className="text-xs text-gray-400 text-right mb-1">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                        {m.text && renderText(m.text)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-400">No messages yet.</div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="bg-neutral-800/75 px-6 py-4 flex items-start space-x-2">
            <textarea
              rows={1}
              placeholder="Type a message…"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedChannelId}
              className="flex-1 px-3 py-2 bg-neutral-700 rounded-md text-sm resize-none disabled:opacity-50 text-white"
            />
            <button
              onClick={handleSendClick}
              disabled={!selectedChannelId}
              className="p-2 bg-orange-500 hover:bg-orange-600 rounded-md disabled:opacity-50 text-white"
            >
              <Send size={16} />
            </button>
          </div>
          {error && <p className="text-red-400 text-center text-sm mt-2">{error}</p>}
        </main>
      </div>
    </div>
  );
}

// Helpers
function renderText(txt: string) {
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
