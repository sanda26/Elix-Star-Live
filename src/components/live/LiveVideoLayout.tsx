import React, { useEffect, useRef } from 'react';

const StreamVideo = ({ stream, className, style, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { stream?: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className={className} style={style} {...props} />;
};

interface Peer {
  userId: string;
  stream: MediaStream;
}

interface LiveVideoLayoutProps {
  layoutMode: 'solo' | 'battle_1v1' | 'battle_2v2' | 'cohost';
  hostUserId: string;
  hostName: string;
  remotePeers: Peer[];
  battleState?: {
    opponentUserId?: string;
    opponentName?: string;
    player3UserId?: string;
    player3Name?: string;
    player4UserId?: string;
    player4Name?: string;
    winner?: string;
  };
  hasStream: boolean;
  className?: string;
}

export function LiveVideoLayout({
  layoutMode,
  hostUserId,
  hostName,
  remotePeers,
  battleState,
  hasStream,
  className = ''
}: LiveVideoLayoutProps) {

  // Solo Mode
  if (layoutMode === 'solo') {
    return (
      <div className={`w-full h-full relative bg-black ${className}`}>
        <StreamVideo
          stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
          className="w-full h-full object-cover"
          style={{ opacity: hasStream ? 1 : 0 }}
        />
      </div>
    );
  }

  // Battle 1v1 or 2v2
  if (layoutMode === 'battle_1v1' || layoutMode === 'battle_2v2') {
    return (
      <div className={`w-full flex flex-col ${className} aspect-[800/433]`}>
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-1 min-h-0">
            {/* Host Video (Top/Left) */}
            <div className="w-1/2 h-full relative bg-black overflow-hidden border-r border-[#C9A96E]/20">
              <StreamVideo
                stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
                className="w-full h-full object-cover"
                style={{ opacity: hasStream ? 1 : 0 }}
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                <span className="text-white text-[10px] font-bold">{hostName}</span>
              </div>
              {battleState?.winner === 'host' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-4xl font-black text-[#C9A96E] drop-shadow-lg rotate-[-12deg]">WINNER</span>
                </div>
              )}
            </div>

            {/* Opponent Video (Top/Right) */}
            <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center">
              {remotePeers.find(p => p.userId === battleState?.opponentUserId)?.stream ? (
                <StreamVideo
                  stream={remotePeers.find(p => p.userId === battleState?.opponentUserId)?.stream}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#13151A] border-2 border-blue-500 flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl">VS</span>
                  </div>
                  <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{battleState?.opponentName || 'Opponent'}</p>
                </div>
              )}
              {battleState?.winner === 'opponent' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-4xl font-black text-blue-500 drop-shadow-lg rotate-[-12deg]">WINNER</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Player 3 & 4 (if 2v2) */}
          {layoutMode === 'battle_2v2' && (
            <div className="flex flex-1 min-h-0 border-t border-[#C9A96E]/20">
              {/* Player 3 */}
              <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center border-r border-[#C9A96E]/20">
                {remotePeers.find(p => p.userId === battleState?.player3UserId)?.stream ? (
                  <StreamVideo
                    stream={remotePeers.find(p => p.userId === battleState?.player3UserId)?.stream}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{battleState?.player3Name || 'P3'}</p>
                  </div>
                )}
                {battleState?.winner === 'player3' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-4xl font-black text-[#C9A96E] drop-shadow-lg rotate-[-12deg]">WINNER</span>
                  </div>
                )}
              </div>
              {/* Player 4 */}
              <div className="w-1/2 h-full relative bg-[#1C1E24] overflow-hidden flex items-center justify-center">
                {remotePeers.find(p => p.userId === battleState?.player4UserId)?.stream ? (
                  <StreamVideo
                    stream={remotePeers.find(p => p.userId === battleState?.player4UserId)?.stream}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <p className="text-white/60 text-xs font-bold truncate max-w-[80px]">{battleState?.player4Name || 'P4'}</p>
                  </div>
                )}
                {battleState?.winner === 'player4' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-4xl font-black text-blue-500 drop-shadow-lg rotate-[-12deg]">WINNER</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Co-Host Mode
  if (layoutMode === 'cohost') {
    return (
      <div className={`w-full h-full flex flex-col bg-black ${className}`}>
        {/* Host (Top) */}
        <div className="flex-1 relative border-b border-white/10">
          <StreamVideo
            stream={remotePeers.find(p => p.userId === hostUserId)?.stream || remotePeers[0]?.stream}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
            <span className="text-white text-[10px] font-bold">{hostName}</span>
          </div>
        </div>
        {/* Guest (Bottom) */}
        <div className="flex-1 relative bg-[#1C1E24] flex items-center justify-center">
          {remotePeers.length > 1 && remotePeers[1]?.stream ? (
            <StreamVideo
              stream={remotePeers[1].stream}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-white/50 text-xs">Connecting...</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}