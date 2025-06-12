// src/pages/SignupPage.tsx

import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { useNavigate, Link } from "react-router-dom";
import { MUTATION_CREATE_USER } from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";

export default function SignupPage() {
  useEffect(() => {
    document.title = "Sign Up";
  }, []);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const [createUser, { loading }] = useMutation(MUTATION_CREATE_USER, {
    onCompleted() {
      login();
      navigate("/dashboard", { replace: true });
    },
    onError(err) {
      setErrorMsg(err.message.replace("GraphQL error: ", ""));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    createUser({ variables: { username, email, password } });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-900">
      <div className="w-full max-w-sm px-6 py-10 bg-neutral-800/75 backdrop-blur-sm rounded-xl shadow-lg">
        {/* Title: simply "Sign Up" */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-extrabold text-white">Sign Up</h1>
        </div>

        {errorMsg && (
          <p className="text-red-400 text-center mb-4">{errorMsg}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-700 text-white border border-neutral-600 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center px-4 py-2 bg-orange-500 text-white font-medium rounded-md shadow
                       hover:bg-red-600 hover:shadow-lg transition-colors duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-orange-400 font-medium hover:text-red-500 transition-colors duration-200"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
