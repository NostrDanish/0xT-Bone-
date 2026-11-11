import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home,
  Bell,
  Search,
  Radio,
  Lock,
  Settings as SettingsIcon,
  PenLine,
  Bone,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { displayName, avatarUrl, fallbackAvatar, shortNpub } from "../lib/nostr";
import Composer from "./Composer";

const NAV = [
  { to: "/", label: "Feeds", icon: Home },
  { to: "/notifications", label: "Inbox", icon: Bell },
  { to: "/search", label: "Search", icon: Search },
  { to: "/relays", label: "Relays", icon: Radio },
  { to: "/toolbox", label: "Toolbox", icon: Lock },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout() {
  const { signer, logout, settings } = useApp();
  const [composeOpen, setComposeOpen] = useState(false);
  const navigate = useNavigate();

  // background notifications counter
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const h = window.setInterval(() => {
      const n = Number(sessionStorage.getItem("tb.unread") ?? "0");
      setUnread(n);
    }, 2000);
    return () => window.clearInterval(h);
  }, []);

  return (
    <div className="min-h-screen bg-app text-fg flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-line bg-surface h-screen sticky top-0 flex flex-col max-md:w-14">
        <div className="px-4 py-5 max-md:px-2 flex items-center gap-2">
          <Bone className="accent-text" size={26} />
          <span className="text-xl font-bold max-md:hidden">T-Bone</span>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 btn max-md:justify-center ${
                  isActive ? "bg-surface-2 font-semibold" : "text-dim"
                }`
              }
            >
              <Icon size={20} />
              <span className="max-md:hidden">{label}</span>
              {to === "/notifications" && unread > 0 && (
                <span className="ml-auto accent-bg text-xs px-1.5 py-0.5 pill max-md:hidden" style={{ color: "var(--accent-contrast)" }}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          ))}

          <button
            onClick={() => setComposeOpen(true)}
            className="accent-btn w-full flex items-center justify-center gap-2 px-3 py-2.5 mt-3 max-md:hidden"
          >
            <PenLine size={18} /> New note
          </button>
        </nav>

        {/* account */}
        <div className="p-2 border-t border-line">
          <button
            onClick={() => navigate(`/p/${signer!.pubkey}`)}
            className="w-full flex items-center gap-2 p-2 btn"
          >
            <img
              src={avatarUrl(signer!.pubkey) ?? fallbackAvatar(signer!.pubkey)}
              className="w-9 h-9 rounded-full object-cover"
              alt=""
            />
            <div className="text-left min-w-0 max-md:hidden">
              <div className="text-sm font-semibold truncate">{displayName(signer!.pubkey)}</div>
              <div className="text-xs text-dim truncate">{shortNpub(signer!.pubkey)}</div>
            </div>
          </button>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 btn text-dim text-sm max-md:hidden">
            <LogOut size={16} /> Log out
          </button>
        </div>

        <a
          href="https://shakespeare.diy"
          target="_blank"
          rel="noreferrer"
          className="text-center text-[11px] text-dim pb-3 max-md:hidden hover:underline"
        >
          Vibed with Shakespeare
        </a>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>

      {composeOpen && <Composer onClose={() => setComposeOpen(false)} />}

      {/* Mobile FAB */}
      <button
        onClick={() => setComposeOpen(true)}
        className="accent-btn fixed bottom-5 right-5 w-14 h-14 rounded-full shadow-lg md:hidden flex items-center justify-center z-40"
        aria-label="New note"
      >
        <PenLine size={22} />
      </button>
    </div>
  );
}
