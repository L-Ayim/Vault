// src/pages/GroupMembersPage.tsx
"use client";

import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import {
  QUERY_GROUP_MEMBERS,
  QUERY_MY_GROUPS,
  MUTATION_REMOVE_GROUP_MEMBER,
  MUTATION_LEAVE_GROUP,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";

interface Member {
  id: string;
  username: string;
}
interface Group {
  id: string;
  owner: { id: string };
}

export default function GroupMembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Group Members";
  }, []);

  const { data, loading, error, refetch } = useQuery<{ groupMembers: Member[] }>(
    QUERY_GROUP_MEMBERS,
    { variables: { groupId: groupId || "" }, skip: !groupId }
  );

  const { data: myGroups } = useQuery<{ myGroups: Group[] }>(QUERY_MY_GROUPS, {
    variables: { limit: 50, offset: 0 },
  });

  const group = myGroups?.myGroups.find((g) => g.id === groupId);
  const isOwner = group?.owner.id === user?.id;

  const [removeMember] = useMutation(MUTATION_REMOVE_GROUP_MEMBER, {
    onCompleted: () => refetch(),
  });

  const [leaveGroup] = useMutation(MUTATION_LEAVE_GROUP, {
    onCompleted: () => navigate("/dashboard"),
  });

  if (loading) return <div className="p-6 text-white">Loading…</div>;
  if (error) return <div className="p-6 text-red-500">Error loading group.</div>;

  const members = data?.groupMembers || [];

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
        <h1 className="text-2xl font-extrabold">
          <span className="text-red-500">V</span>ault
        </h1>
        <div className="flex items-center space-x-4">
          <span>{user?.username}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-4 py-2 bg-orange-500 rounded-md"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 space-y-4 overflow-auto">
        <h2 className="text-2xl font-semibold mb-4">Group Members</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between bg-neutral-800 p-3 rounded"
            >
              <span>{m.username}</span>
              <div className="space-x-2">
                {isOwner && m.id !== user?.id && (
                  <button
                    onClick={() =>
                      removeMember({ variables: { groupId, userId: m.id } })
                    }
                    className="px-2 py-1 text-sm bg-red-600 rounded"
                  >
                    Remove
                  </button>
                )}
                {m.id === user?.id && (
                  <button
                    onClick={() =>
                      leaveGroup({ variables: { groupId } })
                    }
                    className="px-2 py-1 text-sm bg-red-600 rounded"
                  >
                    Leave Group
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
