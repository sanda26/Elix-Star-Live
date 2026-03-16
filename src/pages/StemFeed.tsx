import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EnhancedVideoPlayer from "../components/EnhancedVideoPlayer";
import { useVideoStore } from "../store/useVideoStore";

export default function StemFeed() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { stemVideos, fetchStemVideos, stemLoading } = useVideoStore();

  useEffect(() => {
    fetchStemVideos();
  }, [fetchStemVideos]);

  useEffect(() => {
    if (location.pathname === "/stem") {
      setActiveIndex(0);
      fetchStemVideos();
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      }, 0);
    }
  }, [location.pathname, fetchStemVideos]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index >= 0 && index < stemVideos.length) {
      setActiveIndex(index);
    }
  };

  const handleVideoEnd = (index: number) => {
    if (!containerRef.current || index >= stemVideos.length - 1) return;
    containerRef.current.scrollTo({
      top: (index + 1) * containerRef.current.clientHeight,
      behavior: "smooth",
    });
  };

  const prevCountRef = useRef(stemVideos.length);
  useEffect(() => {
    const prev = prevCountRef.current;
    const cur = stemVideos.length;
    prevCountRef.current = cur;
    if (cur < prev && activeIndex >= cur && cur > 0) {
      setActiveIndex(cur - 1);
      containerRef.current?.scrollTo({
        top: (cur - 1) * (containerRef.current?.clientHeight || 0),
        behavior: "smooth",
      });
    }
  }, [stemVideos.length, activeIndex]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-[#0A0B0E]"
      style={{ scrollSnapType: "y mandatory" }}
      onScroll={handleScroll}
    >
      {/* Top Navigation Bar */}
      <div
        className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none"
        style={{ top: "calc(var(--safe-top) + 2px)" }}
      >
        <div className="w-full max-w-[480px] relative px-2">
          <div
            className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[200%] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(201,169,110,0.05) 40%, transparent 70%)",
            }}
          />
          <div className="relative w-full">
            <img
              src="/Icons/topbar.png"
              alt="Navigation"
              className="w-full h-auto pointer-events-none"
              style={{
                filter:
                  "drop-shadow(0 0 20px rgba(201,169,110,0.4)) drop-shadow(0 4px 30px rgba(201,169,110,0.2)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
              }}
            />
            <div className="absolute inset-0 flex items-center pointer-events-auto z-10">
              <button
                type="button"
                onClick={() => navigate("/live", { replace: true })}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "13%", minWidth: 0 }}
                title="Live"
              />
              <button
                type="button"
                onClick={() => navigate("/stem")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "12%", minWidth: 0 }}
                title="STEM"
              />
              <button
                type="button"
                onClick={() => navigate("/discover")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="Explore"
              />
              <button
                type="button"
                onClick={() => navigate("/following")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "18%", minWidth: 0 }}
                title="Following"
              />
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "12%", minWidth: 0 }}
                title="Shop"
              />
              <button
                type="button"
                onClick={() => navigate("/feed", { replace: true })}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="For You"
              />
              <button
                type="button"
                onClick={() => navigate("/search")}
                className="h-full w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                style={{ width: "15%", minWidth: 0 }}
                title="Search"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen video feed — most viewed first */}
      {stemVideos.map((video, index) => (
        <div
          key={`stem-${video.id}-${index}`}
          className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#0A0B0E]"
          style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
        >
          <div
            className="w-full max-w-[480px] relative"
            style={{ height: "calc(100dvh - 7cm + 0.5mm)", marginTop: "15mm" }}
          >
            <EnhancedVideoPlayer
              videoId={video.id}
              isActive={activeIndex === index}
              onVideoEnd={() => handleVideoEnd(index)}
            />
          </div>
        </div>
      ))}

      {stemLoading && stemVideos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!stemLoading && stemVideos.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-[#13151A] border border-white/10 flex items-center justify-center mb-4">
            <span className="text-3xl">🔥</span>
          </div>
          <p className="text-white/60 font-semibold text-base mb-1">
            Most viewed
          </p>
          <p className="text-white/30 text-sm mb-4">
            No videos yet. Check back later.
          </p>
          <button
            onClick={() => fetchStemVideos()}
            className="px-5 py-2 bg-[#C9A96E]/20 border border-[#C9A96E]/40 rounded-full text-[#C9A96E] text-sm font-bold pointer-events-auto active:scale-95 transition-transform"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
