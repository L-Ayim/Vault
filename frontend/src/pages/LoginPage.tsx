// src/pages/LoginPage.tsx

import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { MUTATION_TOKEN_AUTH } from "../graphql/operations";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  useEffect(() => {
    document.title = "Log In";
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If ProtectedRoute provided a `from`, use it; otherwise default to /dashboard
  const state = location.state as { from?: { pathname: string } } | null;
  const redirectTo = state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const [tokenAuth, { loading }] = useMutation(MUTATION_TOKEN_AUTH, {
    onCompleted(data) {
      const token = data.tokenAuth.token;
      if (token) {
        login(token);
      }
    },
    onError(err) {
      setErrorMsg(err.message.replace("GraphQL error: ", ""));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    tokenAuth({ variables: { username, password } });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 px-4">
      <div className="w-full max-w-sm px-6 py-10 bg-neutral-800/75 backdrop-blur-sm rounded-xl shadow-lg">
        {/* Title: simply "Log In" */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-extrabold text-white">Log In</h1>
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
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Don’t have an account?{" "}
          <Link
            to="/signup"
            className="text-orange-400 font-medium hover:text-red-500 transition-colors duration-200"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
