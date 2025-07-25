// src/pages/ChatPage.tsx

"use client";

import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  QUERY_FRIENDS,
  QUERY_MY_GROUPS,
  QUERY_MY_NODES,
  QUERY_CHANNEL_MESSAGES,
  QUERY_MY_CHANNELS,
  MUTATION_CREATE_DIRECT_CHANNEL,
  MUTATION_JOIN_GROUP_CHANNEL,
  MUTATION_JOIN_NODE_CHANNEL,
  MUTATION_SEND_MESSAGE,
  MUTATION_CREATE_FRIEND_INVITE,
  MUTATION_REDEEM_FRIEND_INVITE,
  MUTATION_CREATE_GROUP,
  MUTATION_JOIN_GROUP_BY_INVITE,
  MUTATION_DELETE_GROUP,
  SUBSCRIPTION_NODE_UPDATES,
  SUBSCRIPTION_MESSAGE_UPDATES,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";
import usePersistentState from "../hooks/usePersistentState";
import { useSearchParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import {
  Clipboard,
  Send,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Trash2,
} from "lucide-react";

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    resolve();
  });
}

interface Friend { id: string; username: string }
interface Group {
  id: string;
  name: string;
  inviteCode: string;
  owner: { id: string };
}
interface NodeItem { id: string; name: string }
interface Message {
  id: string
  sender: { id: string; username: string }
  text: string | null
  createdAt: string
}
interface ChannelInfo {
  id: string
  channelType: string
  directUser1?: { id: string }
  directUser2?: { id: string }
  group?: { id: string }
}

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // panel open state
  const [panelOpen, setPanelOpen] = usePersistentState<boolean>(
    "chat-panel-open",
    true
  );

  // chat UI state
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [copiedFriend, setCopiedFriend] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupInviteCode, setGroupInviteCode] = useState<string | null>(null);
  const [copiedGroup, setCopiedGroup] = useState(false);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [joinGroupCode, setJoinGroupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // WebRTC removed

  useEffect(() => { document.title = "Chat" }, []);

  const { data: friendsData, loading: friendsLoading, error: friendsError, refetch: refetchFriends } =
    useQuery<{ friends: Friend[] }>(QUERY_FRIENDS, { variables:{ limit:50, offset:0 } });

  const { data: groupsData, loading: groupsLoading, error: groupsError, refetch: refetchGroups } =
    useQuery<{ myGroups: Group[] }>(QUERY_MY_GROUPS, { variables:{ limit:50, offset:0 } });

  const { data: nodesData, loading: nodesLoading, error: nodesError, refetch: refetchNodes } =
    useQuery<{ myNodes: NodeItem[] }>(QUERY_MY_NODES, { variables:{ limit:50, offset:0 } });

  const { refetch: refetchChannels } =
    useQuery<{ myChannels: ChannelInfo[] }>(QUERY_MY_CHANNELS);

  const { data: messagesData, loading: messagesLoading, error: messagesError, refetch: refetchMessages } =
    useQuery<{ channelMessages: Message[] }>(QUERY_CHANNEL_MESSAGES, {
      variables:{ channelId:selectedChannelId||"", limit:50, offset:0 },
      skip: !selectedChannelId,
      fetchPolicy:"network-only",
    });

  // Subscribe for updates and refetch lists when events fire
  const { data: subData } = useSubscription(SUBSCRIPTION_NODE_UPDATES);
  const { data: msgSub } = useSubscription(SUBSCRIPTION_MESSAGE_UPDATES, {
    variables: { channelId: selectedChannelId || "" },
    skip: !selectedChannelId,
  });
  useEffect(() => {
    if (subData) {
      refetchFriends();
      refetchGroups();
      refetchNodes();
      refetchChannels();
      if (selectedChannelId) {
        refetchMessages();
      }
    }
  }, [subData, refetchFriends, refetchGroups, refetchNodes, refetchMessages, refetchChannels, selectedChannelId]);
  useEffect(() => {
    if (msgSub && selectedChannelId) {
      refetchMessages();
    }
    if (msgSub) refetchChannels();
  }, [msgSub, selectedChannelId, refetchMessages, refetchChannels]);

  const [createDirectChannel] = useMutation(MUTATION_CREATE_DIRECT_CHANNEL, {
    onCompleted: ({ createDirectChannel }) => {
      setSelectedChannelId(createDirectChannel.channel.id);
      setMessageText("");
      setPanelOpen(false);
    },
  });

  const [joinGroupChannel] = useMutation(MUTATION_JOIN_GROUP_CHANNEL, {
    onCompleted: ({ joinGroupChannel }) => {
      setSelectedChannelId(joinGroupChannel.channel.id);
      setMessageText("");
      setPanelOpen(false);
    },
  });

  const [joinNodeChannel] = useMutation(MUTATION_JOIN_NODE_CHANNEL, {
    onCompleted: ({ joinNodeChannel }) => {
      setSelectedChannelId(joinNodeChannel.channel.id);
      setMessageText("");
      setPanelOpen(false);
    },
  });

  const [sendMessage] = useMutation(MUTATION_SEND_MESSAGE, {
    onCompleted: () => {
      setMessageText("");
      setError(null);
      if (selectedChannelId) {
        refetchMessages();
      }
    },
    onError: () => setError("Failed to send. Please try again."),
  });

  const [createFriendInvite] = useMutation(MUTATION_CREATE_FRIEND_INVITE, {
    onCompleted: res => setInviteCode(res.createFriendInvite.invite.code),
  });

  const [createGroup, { loading: creatingGroup, error: createGroupError }] =
    useMutation(MUTATION_CREATE_GROUP, {
      onCompleted: res => {
        setGroupInviteCode(res.createGroup.group.inviteCode);
        refetchGroups();
        setNewGroupName("");
      },
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

  const [joinGroupByInvite, { loading: joiningGroup, error: joinGroupError }] =
    useMutation(MUTATION_JOIN_GROUP_BY_INVITE, {
      onCompleted: res => {
        const gid = res.joinGroupByInvite.group.id;
        selectGroup(gid);
        refetchGroups();
        setJoinGroupCode("");
        setPanelOpen(false);
      },
    });

  const [deleteGroup] = useMutation(MUTATION_DELETE_GROUP, {
    onCompleted: () => {
      refetchGroups();
    },
  });

  useEffect(() => {
    const f = searchParams.get("invite");
    if (f) {
      let raw = f;
      try { raw = new URL(f).searchParams.get("invite") || f; } catch {
        /* ignore invalid URL */
      }
      redeemFriendInvite({ variables:{ code:raw } });
    }
  }, [searchParams]);

  useEffect(() => {
    const g = searchParams.get("group");
    if (g) {
      let raw = g;
      try { raw = new URL(g).searchParams.get("group") || g; } catch {
        /* ignore invalid URL */
      }
      joinGroupByInvite({ variables:{ inviteCode:raw } });
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
      setSelectedGroupId(null);
      setSelectedNodeId(null);
    } else {
      setSelectedFriendId(id);
      setSelectedGroupId(null);
      setSelectedNodeId(null);
      createDirectChannel({ variables:{ withUserId:id }});
    }
  }

  function selectGroup(id:string){
    if(selectedGroupId===id){
      setSelectedGroupId(null);
      setSelectedChannelId(null);
      setSelectedFriendId(null);
      setSelectedNodeId(null);
    } else {
      setSelectedGroupId(id);
      setSelectedFriendId(null);
      setSelectedNodeId(null);
      joinGroupChannel({ variables:{ groupId:id }});
    }
  }

  function selectNode(id:string){
    if(selectedNodeId===id){
      setSelectedNodeId(null);
      setSelectedChannelId(null);
      setSelectedFriendId(null);
      setSelectedGroupId(null);
    } else {
      setSelectedNodeId(id);
      setSelectedFriendId(null);
      setSelectedGroupId(null);
      joinNodeChannel({ variables:{ nodeId:id }});
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
    copyToClipboard(`${window.location.origin}/chat?invite=${inviteCode}`)
      .then(()=>{ setCopiedFriend(true); setTimeout(()=>setCopiedFriend(false),2000) });
  };

  const handleCopyGroup = (code?: string, id?: string) => {
    const invite = code || groupInviteCode;
    if(!invite) return;
    copyToClipboard(`${window.location.origin}/chat?group=${invite}`)
      .then(()=>{
        if(id){
          setCopiedGroupId(id);
          setTimeout(()=>setCopiedGroupId(null),2000);
        } else {
          setCopiedGroup(true);
          setTimeout(()=>setCopiedGroup(false),2000);
        }
      });
  };

  const handleDeleteGroup = (id: string) => {
    if(confirm("Delete this group?")){
      if(selectedGroupId === id){
        setSelectedGroupId(null);
        setSelectedChannelId(null);
      }
      deleteGroup({ variables:{ groupId:id } });
    }
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

            <div className="flex-1 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Friends</h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                {friendsData!.friends.length ? (
                  friendsData!.friends.map(f => (
                    <button
                      key={f.id}
                      onClick={() => selectFriend(f.id)}
                      className={`
                        w-full text-left px-3 py-2 rounded-md focus:outline-none flex justify-between items-center
                        ${selectedFriendId === f.id
                          ? "bg-red-600"
                          : "bg-orange-500 hover:bg-orange-600"}
                      `}
                    >
                      <span>{f.username}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No friends available.</p>
                )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Groups</h3>
                {groupsLoading && <div>Loading…</div>}
                {groupsError && <div>Error loading groups</div>}
                {!groupsLoading && !groupsError && (
                  groupsData && groupsData.myGroups.length ? (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                    {groupsData.myGroups.map(g => (
                      <div key={g.id} className="flex items-center space-x-2">
                        <button
                          onClick={() => selectGroup(g.id)}
                          className={`
                            flex-1 text-left px-3 py-2 rounded-md focus:outline-none flex justify-between items-center
                            ${selectedGroupId === g.id
                              ? "bg-red-600"
                              : "bg-orange-500 hover:bg-orange-600"}
                          `}
                        >
                          <span>{copiedGroupId === g.id ? "Copied" : g.name}</span>
                        </button>
                        <button
                          onClick={() => handleCopyGroup(g.inviteCode, g.id)}
                          className={`p-2 rounded ${copiedGroupId === g.id ? "bg-red-600" : "bg-neutral-700 hover:bg-neutral-600"}`}
                        >
                          {copiedGroupId === g.id ? "✓" : <Clipboard size={16} />}
                        </button>
                        {user?.id === g.owner.id && (
                          <button
                            onClick={() => handleDeleteGroup(g.id)}
                            className="p-2 bg-neutral-700 hover:bg-red-600 rounded"
                          >
                            <Trash2 size={16} className="text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No groups available.</p>
                  )
                )}
              </div>

              <details className="border border-neutral-700 rounded-md p-3">
                <summary className="cursor-pointer text-sm font-medium flex items-center">
                  <UserPlus className="mr-2 text-orange-500" /> Create / Join Group
                </summary>
                <div className="mt-2 space-y-3">
                  <div className="flex space-x-2 items-stretch">
                    <input
                      type="text"
                      placeholder="New group name"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-neutral-700 rounded-md text-sm"
                    />
                    <button
                      onClick={() =>
                        createGroup({ variables: { name: newGroupName.trim(), singleUse: false, maxInviteUses: 100 } })
                      }
                      disabled={creatingGroup || !newGroupName.trim()}
                      className={`px-3 py-1 rounded ${creatingGroup ? "bg-neutral-600" : "bg-orange-500 hover:bg-orange-600"}`}
                    >
                      {creatingGroup ? "Creating…" : "Create"}
                    </button>
                  </div>
                  {groupInviteCode && (
                    <div className="flex items-center space-x-2">
                      <input
                        readOnly
                        value={
                          copiedGroup
                            ? "Copied!"
                            : `${window.location.origin}/chat?group=${groupInviteCode}`
                        }
                        className="flex-1 px-3 py-2 bg-neutral-700 rounded-md text-sm"
                      />
                      <button
                        onClick={() => handleCopyGroup()}
                        className={`p-2 rounded ${copiedGroup ? "bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                      >
                        <Clipboard size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Paste group invite link or code"
                      value={joinGroupCode}
                      onChange={e => setJoinGroupCode(e.target.value)}
                      className="flex-1 px-2 py-1 bg-neutral-700 rounded-md text-sm"
                    />
                    <button
                      onClick={() => {
                        const code = joinGroupCode.trim().replace(/.*group=/, "");
                        joinGroupByInvite({ variables: { inviteCode: code } });
                      }}
                      disabled={joiningGroup}
                      className={`px-3 py-1 rounded ${joiningGroup ? "bg-neutral-600" : "bg-orange-500 hover:bg-orange-600"}`}
                    >
                      {joiningGroup ? "Joining…" : "Join"}
                    </button>
                  </div>
                  {createGroupError && (
                    <p className="text-red-400 text-sm">{createGroupError.message}</p>
                  )}
                  {joinGroupError && (
                    <p className="text-red-400 text-sm">{joinGroupError.message}</p>
                  )}
                </div>
              </details>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Nodes</h3>
                {nodesLoading && <div>Loading…</div>}
                {nodesError && <div>Error loading nodes</div>}
                {!nodesLoading && !nodesError && (
                  nodesData && nodesData.myNodes.length ? (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                    {nodesData.myNodes.map(n => (
                      <button
                        key={n.id}
                        onClick={() => selectNode(n.id)}
                        className={`
                          w-full text-left px-3 py-2 rounded-md focus:outline-none
                          ${selectedNodeId === n.id
                            ? "bg-red-600"
                            : "bg-orange-500 hover:bg-orange-600"}
                        `}
                      >
                        {n.name}
                      </button>
                    ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No nodes available.</p>
                  )
                )}
              </div>
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
              <div className="text-gray-400">Select a channel to start chatting.</div>
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
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
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
