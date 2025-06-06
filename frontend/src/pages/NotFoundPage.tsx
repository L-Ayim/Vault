// src/pages/NotFoundPage.tsx

import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  // Set the browser tab’s title to “404: Not Found”
  useEffect(() => {
    document.title = "404: Not Found";
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-900 px-4">
      <div className="w-full max-w-md bg-neutral-800/75 backdrop-blur-sm rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-6xl font-extrabold text-white mb-4">404</h1>
        <p className="text-gray-300 text-lg mb-6">
          Oops—this page doesn’t exist.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2 bg-orange-500 text-white font-medium rounded-md shadow
                     hover:bg-red-600 hover:shadow-lg transition-colors duration-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
