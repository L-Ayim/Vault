// src/pages/DashboardPage.tsx

import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { HardDrive, GitBranch, MessageCircle, Settings } from "lucide-react";

export default function DashboardPage() {
  // Set the browser tab’s title to “Dashboard”
  useEffect(() => {
    document.title = "Dashboard";
  }, []);


  return (
    <div className="flex flex-col h-screen bg-neutral-900">
      {/* Header */}
      <Header />

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
