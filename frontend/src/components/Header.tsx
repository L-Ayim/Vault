import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import React from "react";

interface HeaderProps { children?: React.ReactNode }

export default function Header({ children }: HeaderProps) {
  const { user, logout } = useAuth();
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-neutral-800/75 backdrop-blur-sm">
      <Link to="/dashboard" className="text-2xl font-extrabold flex items-center">
        <span className="text-red-500">V</span>
        <span className="text-white">ault</span>
      </Link>
      <div className="flex items-center space-x-4">
        {children}
        <span className="text-gray-200">{user?.username}</span>
        <button
          onClick={logout}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-md text-white"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
