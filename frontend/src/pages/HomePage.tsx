// src/pages/HomePage.tsx

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  // Set the browser tab title to “Vault” when this component mounts
  useEffect(() => {
    document.title = "Vault";
  }, []);

  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-800">
      <div className="text-center space-y-8">
        {/* Title: "V" in red, "ault" in white */}
        <h1 className="text-6xl font-extrabold">
          <span className="text-red-500">V</span>
          <span className="text-white">ault</span>
        </h1>

        {/* Buttons */}
        <div className="flex space-x-6 justify-center">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-orange-500 text-white rounded-md text-lg font-medium
                           hover:bg-red-600 transition-colors duration-200"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="px-6 py-3 bg-orange-500 text-white rounded-md text-lg font-medium
                           hover:bg-red-600 transition-colors duration-200"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-6 py-3 bg-orange-500 text-white rounded-md text-lg font-medium
                           hover:bg-red-600 transition-colors duration-200"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-6 py-3 bg-orange-500 text-white rounded-md text-lg font-medium
                           hover:bg-red-600 transition-colors duration-200"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
