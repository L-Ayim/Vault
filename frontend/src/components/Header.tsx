import { Link } from "react-router-dom";
import { Menu } from "@headlessui/react";
import { ChevronDown, User } from "lucide-react";
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
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center space-x-2 focus:outline-none">
            {user?.profile?.avatarUrl ? (
              <img
                src={user.profile.avatarUrl}
                alt="Avatar"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-neutral-700 flex items-center justify-center text-gray-300">
                <User size={16} />
              </div>
            )}
            <span className="text-gray-200 hidden sm:block">{user?.username}</span>
            <ChevronDown className="text-gray-400" size={16} />
          </Menu.Button>
          <Menu.Items className="absolute right-0 mt-2 w-40 bg-neutral-800 divide-y divide-neutral-700 rounded-md shadow-lg focus:outline-none z-10">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={logout}
                  className={`${active ? "bg-neutral-700" : ""} w-full text-left px-4 py-2 text-gray-200`}
                >
                  Logout
                </button>
              )}
            </Menu.Item>
          </Menu.Items>
        </Menu>
      </div>
    </header>
  );
}
