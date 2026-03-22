import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, PlusCircle, MessageCircle, User } from "lucide-react";

const items = [
  { path: "/feed", title: "Home", Icon: Home },
  { path: "/friends", title: "Friends", Icon: Users },
  { path: "/create", title: "Create", Icon: PlusCircle },
  { path: "/inbox", title: "Inbox", Icon: MessageCircle },
  { path: "/profile", title: "Profile", Icon: User },
] as const;

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (
    location.pathname === "/live" ||
    location.pathname.startsWith("/live/") ||
    location.pathname.startsWith("/watch/") ||
    location.pathname === "/create" ||
    location.pathname.startsWith("/create/") ||
    location.pathname === "/upload" ||
    location.pathname === "/login" ||
    location.pathname === "/register"
  ) {
    return null;
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 top-auto z-[9998] pb-[var(--safe-bottom)]"
      aria-label="Main"
    >
      <div className="flex justify-center pointer-events-auto">
        <div className="relative w-full max-w-[480px] mx-auto border-t border-white/10 bg-[#1C1E24] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-end justify-around gap-1 px-1 pt-2 pb-1.5">
            {items.map(({ path, title, Icon }) => {
              const active =
                path === "/feed"
                  ? location.pathname === "/feed" || location.pathname === "/"
                  : location.pathname === path ||
                    location.pathname.startsWith(path + "/");
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  title={title}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-1 rounded-lg transition-colors border-0 bg-transparent p-0 m-0 appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                    active ? "text-white" : "text-white/45 active:text-white/70"
                  }`}
                  style={
                    {
                      WebkitTapHighlightColor: "transparent",
                    } as React.CSSProperties
                  }
                >
                  <Icon
                    className="w-6 h-6 shrink-0"
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden
                  />
                  <span className="text-[10px] font-semibold truncate max-w-full leading-tight">
                    {title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
