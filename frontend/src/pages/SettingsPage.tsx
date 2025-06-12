// src/pages/SettingsPage.tsx

import { useEffect, useState } from "react";
import { useQuery, useMutation, ApolloError } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { User } from "lucide-react";
import {
  QUERY_ME,
  MUTATION_UPLOAD_FILE,
  MUTATION_UPDATE_PROFILE,
  MUTATION_UPDATE_USER,
  MUTATION_DELETE_ACCOUNT,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";

interface MeResult {
  me: {
    username: string;
    email: string;
    profile: {
      avatarUrl: string | null;
      bio: string | null;
    };
  };
}

export default function SettingsPage() {
  // 1) Set document title
  useEffect(() => {
    document.title = "Settings";
  }, []);

  // 2) Auth & navigation
  const navigate = useNavigate();

  // 3) Fetch current user info
  const { data, loading, error, refetch } = useQuery<MeResult>(QUERY_ME, {
    fetchPolicy: "network-only",
  });

  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [uploadFile] = useMutation(MUTATION_UPLOAD_FILE);
  const [updateProfile, { loading: updating }] = useMutation(MUTATION_UPDATE_PROFILE, {
    onCompleted: async () => {
      setSuccessMsg("Profile updated successfully.");
      await refetch();
      setAvatarFile(null);
    },
    onError: (err: ApolloError) => {
      setErrorMsg(err.message.replace("GraphQL error: ", ""));
    },
  });

  const { logout } = useAuth();

  const [updateUserMutation, { loading: updatingUser }] = useMutation(
    MUTATION_UPDATE_USER,
    {
      onCompleted: async () => {
        setSuccessMsg("Account updated successfully.");
        setNewPassword("");
        await refetch();
      },
      onError: (err: ApolloError) => {
        setErrorMsg(err.message.replace("GraphQL error: ", ""));
      },
    }
  );

  const [deleteAccount] = useMutation(MUTATION_DELETE_ACCOUNT, {
    onCompleted: () => {
      logout();
      navigate("/signup");
    },
    onError: (err: ApolloError) => {
      setErrorMsg(err.message.replace("GraphQL error: ", ""));
    },
  });

  const profile = data?.me.profile;
  const email = data?.me.email;
  const username = data?.me.username;

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
    }
  }, [profile]);

  useEffect(() => {
    if (username) setNewUsername(username);
    if (email) setNewEmail(email);
  }, [username, email]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    let avatarFileId: string | null = null;
    if (avatarFile) {
      try {
        const res = await uploadFile({
          variables: { name: avatarFile.name, upload: avatarFile },
        });
        avatarFileId = res.data.uploadFile.file.id;
      } catch (err) {
        setErrorMsg((err as ApolloError).message.replace("GraphQL error: ", ""));
        return;
      }
    }
    try {
      await updateProfile({
        variables: { avatarFileId, bio },
      });
    } catch {
      // onError handles message
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateUserMutation({
        variables: {
          username: newUsername,
          email: newEmail,
          password: newPassword || null,
        },
      });
    } catch {
      // onError handles message
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete your account permanently?")) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteAccount();
    } catch {
      // onError handles message
    }
  };

  // 5) If no user or data, redirect to login
  if (!username) {
    navigate("/login");
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white">
      {/* Header */}
      <Header />

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
                    <User size={32} />
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

            </div>

            {successMsg && (
              <p className="text-green-500 mt-4">{successMsg}</p>
            )}
            {errorMsg && <p className="text-red-400 mt-4">{errorMsg}</p>}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setAvatarFile(e.target.files ? e.target.files[0] : null)
                  }
                  className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-white hover:file:bg-neutral-600"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>


              <button
                type="submit"
                disabled={updating}
                className="px-4 py-2 bg-orange-500 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {updating ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </section>

          <section className="bg-neutral-800/75 p-6 rounded-lg shadow">
            <h3 className="text-2xl font-medium mb-4">Account Settings</h3>

            {successMsg && (
              <p className="text-green-500 mb-2">{successMsg}</p>
            )}
            {errorMsg && <p className="text-red-400 mb-2">{errorMsg}</p>}

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={updatingUser}
                className="px-4 py-2 bg-orange-500 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {updatingUser ? "Updating…" : "Update Account"}
              </button>
            </form>

            <button
              onClick={handleDeleteAccount}
              className="mt-6 px-4 py-2 bg-red-700 rounded-md hover:bg-red-800 transition-colors"
            >
              Delete Account
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
