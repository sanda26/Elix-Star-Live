import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  VideoPresets,
  LocalTrack,
} from 'livekit-client';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function apiCall(endpoint: string, body: Record<string, unknown> = {}) {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════
// LiveKit SFU Mode
// ═══════════════════════════════════════════════════════════
export class LiveKitSession {
  room: Room;
  private onRemoteTrack: ((track: MediaStreamTrack, participant: RemoteParticipant, publication: RemoteTrackPublication) => void) | null = null;
  private onRemoteTrackUnsubscribed: ((participant: RemoteParticipant) => void) | null = null;
  private onParticipantJoined: ((p: RemoteParticipant) => void) | null = null;
  private onParticipantLeft: ((p: RemoteParticipant) => void) | null = null;
  private onDisconnected: (() => void) | null = null;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
        this.onRemoteTrack?.(track.mediaStreamTrack, participant, pub);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      this.onRemoteTrackUnsubscribed?.(participant);
    });

    this.room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      this.onParticipantJoined?.(p);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      this.onParticipantLeft?.(p);
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.onDisconnected?.();
    });
  }

  async connect(url: string, token: string) {
    await this.room.connect(url, token);
  }

  async publishCamera(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoTrack) {
      await this.room.localParticipant.publishTrack(videoTrack, {
        name: 'camera',
        simulcast: true,
        source: Track.Source.Camera,
      });
    }

    if (audioTrack) {
      await this.room.localParticipant.publishTrack(audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone,
      });
    }
  }

  setOnRemoteTrack(cb: (track: MediaStreamTrack, participant: RemoteParticipant, pub: RemoteTrackPublication) => void) {
    this.onRemoteTrack = cb;
  }

  setOnRemoteTrackUnsubscribed(cb: (participant: RemoteParticipant) => void) {
    this.onRemoteTrackUnsubscribed = cb;
  }

  setOnParticipantJoined(cb: (p: RemoteParticipant) => void) {
    this.onParticipantJoined = cb;
  }

  setOnParticipantLeft(cb: (p: RemoteParticipant) => void) {
    this.onParticipantLeft = cb;
  }

  setOnDisconnected(cb: () => void) {
    this.onDisconnected = cb;
  }

  getParticipantCount(): number {
    return this.room.remoteParticipants.size + 1;
  }

  async disconnect() {
    await this.room.disconnect();
  }
}

// ═══════════════════════════════════════════════════════════
// P2P Fallback Mode (WebRTC via WebSocket signaling)
// ═══════════════════════════════════════════════════════════

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'e3e3b6d4ece6d8079ac1c5c4',
    credential: 'gT+TnFBx87sStYmf',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'e3e3b6d4ece6d8079ac1c5c4',
    credential: 'gT+TnFBx87sStYmf',
  },
  {
    urls: 'turn:global.relay.metered.ca:443?transport=tcp',
    username: 'e3e3b6d4ece6d8079ac1c5c4',
    credential: 'gT+TnFBx87sStYmf',
  },
];

export class P2PSession {
  private ws: WebSocket | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private isHost: boolean;
  private roomId: string;
  private userId: string = '';
  private onRemoteStream: ((stream: MediaStream, peerId: string) => void) | null = null;
  private onPeerDisconnected: ((peerId: string) => void) | null = null;
  private onViewerCount: ((count: number) => void) | null = null;
  private onChatMessage: ((data: any) => void) | null = null;
  private _onDisconnected: (() => void) | null = null;

  constructor(roomId: string, isHost: boolean) {
    this.roomId = roomId;
    this.isHost = isHost;
  }

  async connect(wsUrl: string, token: string) {
    this.userId = JSON.parse(atob(token.split('.')[1])).sub || 'unknown';

    return new Promise<void>((resolve, reject) => {
      const fullUrl = `${wsUrl}/live/${this.roomId}?token=${encodeURIComponent(token)}&host=${this.isHost}`;
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));

      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          this.handleSignaling(msg.event, msg.data);
        } catch {}
      };

      this.ws.onclose = () => {
        this._onDisconnected?.();
      };
    });
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
  }

  private async handleSignaling(event: string, data: any) {
    switch (event) {
      case 'connected':
        if (!this.isHost) {
          this.sendWs('webrtc_request_offer', {});
        }
        break;

      case 'webrtc_request_offer':
        if (this.isHost && this.localStream) {
          await this.createOfferForPeer(data.from);
        }
        break;

      case 'webrtc_offer':
        if (!this.isHost || data.from !== this.userId) {
          await this.handleOffer(data.from, data.sdp);
        }
        break;

      case 'webrtc_answer':
        await this.handleAnswer(data.from, data.sdp);
        break;

      case 'webrtc_ice':
        await this.handleIce(data.from, data.candidate);
        break;

      case 'viewer_count_update':
        this.onViewerCount?.(data.count);
        break;

      case 'chat_message':
        this.onChatMessage?.(data);
        break;

      case 'user_left':
        this.removePeer(data.user_id);
        break;

      case 'user_joined':
        // Host will get a request_offer from the new viewer
        break;
    }
  }

  private async createOfferForPeer(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendWs('webrtc_offer', { sdp: offer, target: peerId });
  }

  private async handleOffer(from: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(from);

    if (this.isHost && this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendWs('webrtc_answer', { sdp: answer, target: from });
  }

  private async handleAnswer(from: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.peers.get(from);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async handleIce(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(from);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      this.peers.get(peerId)!.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(peerId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendWs('webrtc_ice', { candidate: e.candidate.toJSON(), target: peerId });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        this.onRemoteStream?.(e.streams[0], peerId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeer(peerId);
      }
    };

    return pc;
  }

  private removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      this.onPeerDisconnected?.(peerId);
    }
  }

  sendWs(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }

  setOnRemoteStream(cb: (stream: MediaStream, peerId: string) => void) { this.onRemoteStream = cb; }
  setOnPeerDisconnected(cb: (peerId: string) => void) { this.onPeerDisconnected = cb; }
  setOnViewerCount(cb: (count: number) => void) { this.onViewerCount = cb; }
  setOnChatMessage(cb: (data: any) => void) { this.onChatMessage = cb; }
  setOnDisconnected(cb: () => void) { this._onDisconnected = cb; }

  async disconnect() {
    for (const [, pc] of this.peers) pc.close();
    this.peers.clear();
    this.ws?.close();
    this.ws = null;
  }
}

// ═══════════════════════════════════════════════════════════
// Unified API
// ═══════════════════════════════════════════════════════════

export type StreamMode = 'sfu' | 'p2p';

export interface StartLiveResult {
  mode: StreamMode;
  room: string;
  token?: string;
  livekit_url?: string;
  ws_url?: string;
}

export async function startLive(title?: string): Promise<StartLiveResult> {
  return apiCall('/live/start', { title });
}

export async function joinLive(room: string): Promise<StartLiveResult> {
  return apiCall('/live/join', { room });
}

export async function endLive(room: string): Promise<void> {
  await apiCall('/live/end', { room });
}

export async function startBattle(room?: string): Promise<StartLiveResult> {
  return apiCall('/battle/start', { room });
}

export async function joinBattle(room: string): Promise<StartLiveResult> {
  return apiCall('/battle/join', { room });
}
