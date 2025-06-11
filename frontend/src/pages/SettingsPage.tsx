// src/pages/SettingsPage.tsx

import React, { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { QUERY_ME } from "../graphql/operations";

interface MeResult {
  me: {
    username: string;
    email: string;
    profile: {
      avatarUrl: string | null;
      bio: string | null;
      isPublic: boolean;
    };
  };
}

export default function SettingsPage() {
  // 1) Set document title
  useEffect(() => {
    document.title = "Settings";
  }, []);

  // 2) Auth & navigation
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 3) Fetch current user info
  const { data, loading, error } = useQuery<MeResult>(QUERY_ME, {
    fetchPolicy: "network-only",
  });

  // 4) Early loading / error states
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  const profile = data?.me.profile;
  const email = data?.me.email;
  const username = data?.me.username;

  // 5) If no user or data, redirect to login
  if (!username) {
    navigate("/login");
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm space-y-4 sm:space-y-0">
        <div className="text-2xl font-extrabold">
          <span className="text-red-500">V</span>
          <span className="text-white">ault</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-200 font-medium">{username}</span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-md font-medium hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto space-y-8">
          <h2 className="text-3xl font-semibold">Settings</h2>

          <section className="bg-neutral-800/75 p-6 rounded-lg shadow">
            <h3 className="text-2xl font-medium mb-4">Profile Information</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-neutral-700 flex items-center justify-center text-gray-400">
                    N/A
                  </div>
                )}
                <div>
                  <p className="text-gray-300">
                    <span className="font-medium">Username:</span> {username}
                  </p>
                  <p className="text-gray-300">
                    <span className="font-medium">Email:</span> {email}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-gray-300 font-medium mb-1">Bio:</p>
                <p className="text-gray-200">
                  {profile?.bio?.trim() || (
                    <span className="italic text-gray-400">No bio provided.</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-gray-300 font-medium mb-1">Profile Visibility:</p>
                <p className="text-gray-200">
                  {profile?.isPublic ? "Public" : "Private"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
