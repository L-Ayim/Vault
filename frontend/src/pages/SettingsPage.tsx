// src/pages/SettingsPage.tsx

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, ApolloError } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { User } from "lucide-react";
import {
  QUERY_ME,
  MUTATION_UPLOAD_FILE,
  MUTATION_UPDATE_PROFILE,
  MUTATION_DELETE_ACCOUNT,
} from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";

interface MeResult {
  me: {
    username: string;
    email: string;
    profile: {
      avatarUrl: string | null;
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [uploadFile] = useMutation(MUTATION_UPLOAD_FILE);
  const [updateProfile] = useMutation(MUTATION_UPDATE_PROFILE, {
    onCompleted: async () => {
      setSuccessMsg("Profile updated successfully.");
      await refetch();
    },
    onError: (err: ApolloError) => {
      setErrorMsg(err.message.replace("GraphQL error: ", ""));
    },
  });

  const { logout } = useAuth();

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

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await uploadFile({
        variables: { name: file.name, upload: file },
      });
      await updateProfile({
        variables: { avatarFileId: res.data.uploadFile.file.id },
      });
      await refetch();
    } catch (err) {
      setErrorMsg((err as ApolloError).message.replace("GraphQL error: ", ""));
    } finally {
      setShowAvatarOptions(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  const handleRemoveAvatar = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateProfile({ variables: { avatarUrl: "" } });
      setShowAvatarOptions(false);
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
                    className="h-16 w-16 rounded-full object-cover cursor-pointer border-2 border-orange-500"
                    onClick={() => setShowAvatarOptions((v) => !v)}
                  />
                ) : (
                  <div
                    className="h-16 w-16 rounded-full bg-neutral-700 flex items-center justify-center text-gray-400 cursor-pointer border-2 border-orange-500"
                    onClick={() => setShowAvatarOptions((v) => !v)}
                  >
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

            </div>

            {successMsg && (
              <p className="text-green-500 mt-4">{successMsg}</p>
            )}
            {errorMsg && <p className="text-red-400 mt-4">{errorMsg}</p>}

            <form className="space-y-4 mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {showAvatarOptions && (
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 bg-neutral-700 rounded hover:bg-neutral-600"
                  >
                    Upload Image
                  </button>
                  {profile?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-3 py-1 bg-red-700 rounded hover:bg-red-800"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              )}

            </form>
          </section>

          <section className="bg-neutral-800/75 p-6 rounded-lg shadow">
            {successMsg && (
              <p className="text-green-500 mb-2">{successMsg}</p>
            )}
            {errorMsg && <p className="text-red-400 mb-2">{errorMsg}</p>}

            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-700 rounded-md hover:bg-red-800 transition-colors"
            >
              Delete Account
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
