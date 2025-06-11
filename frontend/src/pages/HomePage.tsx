// src/pages/HomePage.tsx

import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  // Set the browser tab title to “Vault” when this component mounts
  useEffect(() => {
    document.title = "Vault";
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-800 px-4">
      <div className="text-center space-y-8">
        {/* Title: "V" in red, "ault" in white */}
        <h1 className="text-5xl sm:text-6xl font-extrabold">
          <span className="text-red-500">V</span>
          <span className="text-white">ault</span>
        </h1>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
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
        </div>
      </div>
    </div>
  );
}
