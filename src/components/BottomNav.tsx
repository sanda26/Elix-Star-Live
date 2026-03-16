import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on fullscreen / immersive pages
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
      className="pointer-events-none bg-transparent"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // Anchor home bar at the very bottom so there is no gap underneath
        bottom: 0,
        top: "auto",
        zIndex: 9998,
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="flex justify-center px-1 bg-transparent">
        <div className="relative w-full max-w-[480px] mx-auto">
          <img
            src="/Icons/bottombar.png"
            alt=""
            className="relative w-full h-auto pointer-events-none block"
            draggable={false}
            style={{
              filter: "drop-shadow(0 0 8px rgba(0,0,0,0.6))",
            }}
          />

          <div className="absolute inset-0 flex items-stretch pointer-events-auto">
            <button
              onClick={() => navigate("/feed")}
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={
                {
                  WebkitTapHighlightColor: "transparent",
                } as React.CSSProperties
              }
              title="Home"
            />
            <button
              onClick={() => navigate("/friends")}
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={
                {
                  WebkitTapHighlightColor: "transparent",
                } as React.CSSProperties
              }
              title="Friends"
            />
            <button
              onClick={() => navigate("/create")}
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={
                {
                  WebkitTapHighlightColor: "transparent",
                } as React.CSSProperties
              }
              title="Create"
            />
            <button
              onClick={() => navigate("/inbox")}
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={
                {
                  WebkitTapHighlightColor: "transparent",
                } as React.CSSProperties
              }
              title="Inbox"
            />
            <button
              onClick={() => navigate("/profile")}
              className="flex-1 h-full bg-transparent border-0 p-0 m-0 appearance-none focus:outline-none active:opacity-70 transition-opacity"
              style={
                {
                  WebkitTapHighlightColor: "transparent",
                } as React.CSSProperties
              }
              title="Profile"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
