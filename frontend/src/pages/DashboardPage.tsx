// src/pages/DashboardPage.tsx

import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { HardDrive, GitBranch, MessageCircle, Settings } from "lucide-react";

export default function DashboardPage() {
  // Set the browser tab’s title to “Dashboard”
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Handle logout: clear token and send back to home
  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-900">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-neutral-800/75 backdrop-blur-sm space-y-4 sm:space-y-0">
        {/* Logo */}
        <div className="text-2xl font-extrabold">
          <Link to="/" className="flex items-center">
            <span className="text-red-500">V</span>
            <span className="text-white">ault</span>
          </Link>
        </div>

        {/* User info and logout */}
        <div className="flex items-center space-x-4">
          <span className="text-gray-200 font-medium">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-orange-500 text-white rounded-md font-medium shadow
                       hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content: center four cards both vertically and horizontally */}
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Storage Card */}
          <Link
            to="/storage"
            className="flex flex-col items-center justify-center p-6 bg-orange-500 rounded-xl shadow-lg
                       hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            <HardDrive size={48} className="text-white mb-4" />
            <h2 className="text-xl font-semibold text-white">Storage</h2>
          </Link>

          {/* Map Card */}
          <Link
            to="/map"
            className="flex flex-col items-center justify-center p-6 bg-orange-500 rounded-xl shadow-lg
                       hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            <GitBranch size={48} className="text-white mb-4" />
            <h2 className="text-xl font-semibold text-white">Map</h2>
          </Link>

          {/* Chat Card (formerly “Social”) */}
          <Link
            to="/chat"
            className="flex flex-col items-center justify-center p-6 bg-orange-500 rounded-xl shadow-lg
                       hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            <MessageCircle size={48} className="text-white mb-4" />
            <h2 className="text-xl font-semibold text-white">Chat</h2>
          </Link>

          {/* Settings Card */}
          <Link
            to="/settings"
            className="flex flex-col items-center justify-center p-6 bg-orange-500 rounded-xl shadow-lg
                       hover:bg-red-600 active:bg-red-700 transition-colors duration-200"
          >
            <Settings size={48} className="text-white mb-4" />
            <h2 className="text-xl font-semibold text-white">Settings</h2>
          </Link>
        </div>
      </main>
    </div>
  );
}
