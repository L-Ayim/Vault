// src/pages/SettingsPage.tsx

import { useEffect, useState } from "react";
import { useQuery, useMutation, ApolloError } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import {
  QUERY_ME,
  MUTATION_UPLOAD_FILE,
  MUTATION_UPDATE_PROFILE,
} from "../graphql/operations";

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
  const navigate = useNavigate();

  // 3) Fetch current user info
  const { data, loading, error, refetch } = useQuery<MeResult>(QUERY_ME, {
    fetchPolicy: "network-only",
  });

  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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

  const profile = data?.me.profile;
  const email = data?.me.email;
  const username = data?.me.username;

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      setIsPublic(profile.isPublic);
    }
  }, [profile]);

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
        variables: { avatarFileId, bio, isPublic },
      });
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

              <div className="flex items-center space-x-2">
                <input
                  id="isPublic"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-5 w-5 text-orange-500"
                />
                <label htmlFor="isPublic" className="text-gray-300">
                  Profile is public
                </label>
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
        </div>
      </main>
    </div>
  );
}
