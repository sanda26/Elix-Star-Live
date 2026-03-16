import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
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
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory relative bg-[#13151A]"
      style={{ scrollSnapType: "y mandatory" }}
      onScroll={handleScroll}
    >
      {/* Header with search + exit (same buttons as Friends) */}
      <div className="fixed left-0 right-0 z-[9999] flex justify-center pointer-events-none">
        <div className="w-full max-w-[480px] px-3 pt-[calc(env(safe-area-inset-top,8px)+6px)] pb-1 flex items-center justify-between pointer-events-auto">
          <button
            onClick={() => navigate("/search")}
            className="p-1"
            aria-label="Search"
          >
            <Search size={18} className="text-white" />
          </button>
          <h1 className="text-sm font-bold text-white">STEM</h1>
          <button
            onClick={() => navigate(-1)}
            title="Back"
            className="p-1"
          >
            <img
              src="/Icons/Gold power buton.png"
              alt="Back"
              className="w-5 h-5"
            />
          </button>
        </div>
      </div>

      {/* Spacer at top so feed content isn't hidden under system UI */}
      <div className="h-[24px]" />

      {/* Full-screen video feed — most viewed first */}
      {stemVideos.map((video, index) => (
        <div
          key={`stem-${video.id}-${index}`}
          className="h-[100dvh] w-full snap-start relative flex justify-center bg-[#13151A]"
          style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
        >
          <div
            className="w-full max-w-[480px] relative"
            style={{ height: "calc(100vh - 3.6cm)", marginTop: "1.1cm" }}
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
