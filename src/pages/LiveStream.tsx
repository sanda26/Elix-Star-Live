import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Send,
  Search,
  Heart,
  Flame,
  MessageCircle,
  Share2,
  RefreshCw,
  Mic,
  MicOff,
  Settings2,
  LogOut,
  Volume2,
  VolumeX,
  Gift,
  MoreVertical,
  Users,
  Zap,
  Trophy,
  Copy,
  AlertTriangle,
  PlusCircle,
  TrendingUp,
  Github,
  Plus,
  Check,
  Smile,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GiftPanel } from '../components/GiftPanel';
import { GIFTS } from '../lib/gifts';
import { GiftOverlay } from '../components/GiftOverlay';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { ChatOverlay } from '../components/ChatOverlay';
import { FaceARGift } from '../components/FaceARGift';
import { useLivePromoStore } from '../store/useLivePromoStore';
import { useAuthStore } from '../store/useAuthStore';
import { clearCachedCameraStream, getCachedCameraStream } from '../lib/cameraStream';
import { supabase } from '../lib/supabase';
import { LevelBadge } from '../components/LevelBadge';
import ReportModal from '../components/ReportModal';
import { RankingPanel } from '../components/RankingPanel';
import { stripePaymentService } from '../lib/stripePaymentService';
import { STRIPE_CONFIG } from '../config/stripe';


type LiveMessage = {
  id: string;
  username: string;
  text: string;
  level?: number;
  isGift?: boolean;
  avatar?: string;
  isSystem?: boolean;
  membershipIcon?: string;
};

type UniverseTickerMessage = {
  id: string;
  sender: string;
  receiver: string;
};

// ═══════════════════════════════════════════════════════════════
// REALISTIC SIMULATED VIEWERS - Real names, photos, levels, chat
// ═══════════════════════════════════════════════════════════════
interface SimulatedViewer {
  id: string;
  username: string;
  displayName: string;
  level: number;
  avatar: string;
  country: string;
  joinedAt: number;
  isActive: boolean;
  chatFrequency: number; // seconds between messages (lower = more active)
  supportDays: number; // how many days this user has supported the streamer (1 heart per day)
  lastVisitDaysAgo: number; // how many days since last visit (0 = today, 1 = yesterday, 2+ = inactive/grey heart)
}

// In production, disable simulated viewers — only real viewers via WebSocket
// In dev, use simulated viewers for testing
const VIEWER_POOL: Omit<SimulatedViewer, 'joinedAt' | 'isActive'>[] = import.meta.env.DEV ? [
  { id: 'v1', username: 'emma_rose22', displayName: 'Emma Rose', level: 34, avatar: 'https://i.pravatar.cc/100?img=1', country: '🇺🇸', chatFrequency: 8, supportDays: 127, lastVisitDaysAgo: 0 },
  { id: 'v2', username: 'alex.madrid', displayName: 'Alex Madrid', level: 18, avatar: 'https://i.pravatar.cc/100?img=3', country: '🇪🇸', chatFrequency: 12, supportDays: 45, lastVisitDaysAgo: 1 },
  { id: 'v3', username: 'sofiab_', displayName: 'Sofia Bianchi', level: 45, avatar: 'https://i.pravatar.cc/100?img=5', country: '🇮🇹', chatFrequency: 6, supportDays: 203, lastVisitDaysAgo: 0 },
  { id: 'v4', username: 'lucassilva7', displayName: 'Lucas Silva', level: 27, avatar: 'https://i.pravatar.cc/100?img=7', country: '🇧🇷', chatFrequency: 10, supportDays: 89, lastVisitDaysAgo: 3 },
  { id: 'v5', username: 'mia.chen_', displayName: 'Mia Chen', level: 52, avatar: 'https://i.pravatar.cc/100?img=9', country: '🇬🇧', chatFrequency: 15, supportDays: 312, lastVisitDaysAgo: 0 },
  { id: 'v6', username: 'david_k99', displayName: 'David Kim', level: 8, avatar: 'https://i.pravatar.cc/100?img=11', country: '🇰🇷', chatFrequency: 20, supportDays: 12, lastVisitDaysAgo: 5 },
  { id: 'v7', username: 'anya.pet', displayName: 'Anya Petrova', level: 61, avatar: 'https://i.pravatar.cc/100?img=13', country: '🇷🇺', chatFrequency: 7, supportDays: 365, lastVisitDaysAgo: 0 },
  { id: 'v8', username: 'marcosantos_', displayName: 'Marco Santos', level: 14, avatar: 'https://i.pravatar.cc/100?img=14', country: '🇧🇷', chatFrequency: 9, supportDays: 34, lastVisitDaysAgo: 4 },
  { id: 'v9', username: 'chloe.dpt', displayName: 'Chloé Dupont', level: 39, avatar: 'https://i.pravatar.cc/100?img=16', country: '🇫🇷', chatFrequency: 11, supportDays: 156, lastVisitDaysAgo: 0 },
  { id: 'v10', username: 'jamesww_', displayName: 'James Wilson', level: 22, avatar: 'https://i.pravatar.cc/100?img=17', country: '🇺🇸', chatFrequency: 14, supportDays: 67, lastVisitDaysAgo: 1 },
  { id: 'v11', username: 'yuki.tnk', displayName: 'Yuki Tanaka', level: 73, avatar: 'https://i.pravatar.cc/100?img=19', country: '🇯🇵', chatFrequency: 5, supportDays: 420, lastVisitDaysAgo: 0 },
  { id: 'v12', username: 'isa_reyes', displayName: 'Isabella Reyes', level: 31, avatar: 'https://i.pravatar.cc/100?img=20', country: '🇲🇽', chatFrequency: 13, supportDays: 98, lastVisitDaysAgo: 2 },
  { id: 'v13', username: 'noah.mllr', displayName: 'Noah Müller', level: 16, avatar: 'https://i.pravatar.cc/100?img=22', country: '🇩🇪', chatFrequency: 18, supportDays: 23, lastVisitDaysAgo: 7 },
  { id: 'v14', username: 'lara_h', displayName: 'Lara Al-Hassan', level: 55, avatar: 'https://i.pravatar.cc/100?img=24', country: '🇦🇪', chatFrequency: 8, supportDays: 278, lastVisitDaysAgo: 0 },
  { id: 'v15', username: 'olibrown', displayName: 'Oliver Brown', level: 10, avatar: 'https://i.pravatar.cc/100?img=25', country: '🇬🇧', chatFrequency: 22, supportDays: 7, lastVisitDaysAgo: 3 },
  { id: 'v16', username: 'cami.lopez', displayName: 'Camila López', level: 42, avatar: 'https://i.pravatar.cc/100?img=26', country: '🇦🇷', chatFrequency: 7, supportDays: 189, lastVisitDaysAgo: 0 },
  { id: 'v17', username: 'liamtaylor_', displayName: 'Liam Taylor', level: 29, avatar: 'https://i.pravatar.cc/100?img=28', country: '🇦🇺', chatFrequency: 16, supportDays: 54, lastVisitDaysAgo: 1 },
  { id: 'v18', username: 'nina.w', displayName: 'Nina Weber', level: 37, avatar: 'https://i.pravatar.cc/100?img=29', country: '🇦🇹', chatFrequency: 10, supportDays: 142, lastVisitDaysAgo: 0 },
  { id: 'v19', username: 'raj_p', displayName: 'Raj Patel', level: 48, avatar: 'https://i.pravatar.cc/100?img=30', country: '🇮🇳', chatFrequency: 9, supportDays: 231, lastVisitDaysAgo: 0 },
  { id: 'v20', username: 'zaraaj', displayName: 'Zara Jones', level: 65, avatar: 'https://i.pravatar.cc/100?img=32', country: '🇺🇸', chatFrequency: 6, supportDays: 345, lastVisitDaysAgo: 0 },
  { id: 'v21', username: 'mateo.g', displayName: 'Mateo García', level: 19, avatar: 'https://i.pravatar.cc/100?img=33', country: '🇪🇸', chatFrequency: 14, supportDays: 41, lastVisitDaysAgo: 6 },
  { id: 'v22', username: 'elena_pop', displayName: 'Elena Popescu', level: 33, avatar: 'https://i.pravatar.cc/100?img=34', country: '🇷🇴', chatFrequency: 8, supportDays: 167, lastVisitDaysAgo: 0 },
  { id: 'v23', username: 'amir.h', displayName: 'Amir Hosseini', level: 25, avatar: 'https://i.pravatar.cc/100?img=36', country: '🇮🇷', chatFrequency: 17, supportDays: 58, lastVisitDaysAgo: 4 },
  { id: 'v24', username: 'lilytan_', displayName: 'Lily Tan', level: 58, avatar: 'https://i.pravatar.cc/100?img=38', country: '🇸🇬', chatFrequency: 7, supportDays: 290, lastVisitDaysAgo: 0 },
  { id: 'v25', username: 'tyler.b', displayName: 'Tyler Brooks', level: 11, avatar: 'https://i.pravatar.cc/100?img=39', country: '🇺🇸', chatFrequency: 25, supportDays: 15, lastVisitDaysAgo: 8 },
  { id: 'v26', username: 'sara_lind', displayName: 'Sara Lindqvist', level: 44, avatar: 'https://i.pravatar.cc/100?img=40', country: '🇸🇪', chatFrequency: 12, supportDays: 198, lastVisitDaysAgo: 1 },
  { id: 'v27', username: 'diego.v', displayName: 'Diego Vargas', level: 20, avatar: 'https://i.pravatar.cc/100?img=41', country: '🇵🇪', chatFrequency: 11, supportDays: 73, lastVisitDaysAgo: 2 },
  { id: 'v28', username: 'hannahlee', displayName: 'Hannah Lee', level: 36, avatar: 'https://i.pravatar.cc/100?img=43', country: '🇨🇦', chatFrequency: 9, supportDays: 134, lastVisitDaysAgo: 0 },
  { id: 'v29', username: 'kai.nkm', displayName: 'Kai Nakamura', level: 71, avatar: 'https://i.pravatar.cc/100?img=44', country: '🇺🇸', chatFrequency: 6, supportDays: 401, lastVisitDaysAgo: 0 },
  { id: 'v30', username: 'vale_rossi', displayName: 'Valentina Rossi', level: 50, avatar: 'https://i.pravatar.cc/100?img=45', country: '🇮🇹', chatFrequency: 8, supportDays: 256, lastVisitDaysAgo: 1 },
  { id: 'v31', username: 'adriana_buc', displayName: 'Adriana Bucur', level: 28, avatar: 'https://i.pravatar.cc/100?img=46', country: '🇷🇴', chatFrequency: 9, supportDays: 82, lastVisitDaysAgo: 3 },
  { id: 'v32', username: 'tomas.cz', displayName: 'Tomáš Novák', level: 15, avatar: 'https://i.pravatar.cc/100?img=47', country: '🇨🇿', chatFrequency: 19, supportDays: 29, lastVisitDaysAgo: 5 },
  { id: 'v33', username: 'priya_sh', displayName: 'Priya Sharma', level: 41, avatar: 'https://i.pravatar.cc/100?img=48', country: '🇮🇳', chatFrequency: 7, supportDays: 175, lastVisitDaysAgo: 0 },
  { id: 'v34', username: 'jake.miller', displayName: 'Jake Miller', level: 6, avatar: 'https://i.pravatar.cc/100?img=49', country: '🇺🇸', chatFrequency: 30, supportDays: 3, lastVisitDaysAgo: 10 },
  { id: 'v35', username: 'fatima_kw', displayName: 'Fatima Al-Sabah', level: 67, avatar: 'https://i.pravatar.cc/100?img=50', country: '🇰🇼', chatFrequency: 8, supportDays: 334, lastVisitDaysAgo: 0 },
  { id: 'v36', username: 'oscar.swe', displayName: 'Oscar Eriksson', level: 23, avatar: 'https://i.pravatar.cc/100?img=51', country: '🇸🇪', chatFrequency: 15, supportDays: 51, lastVisitDaysAgo: 2 },
  { id: 'v37', username: 'amelie_fr', displayName: 'Amélie Martin', level: 38, avatar: 'https://i.pravatar.cc/100?img=52', country: '🇫🇷', chatFrequency: 10, supportDays: 145, lastVisitDaysAgo: 0 },
  { id: 'v38', username: 'chen.wei', displayName: 'Chen Wei', level: 54, avatar: 'https://i.pravatar.cc/100?img=53', country: '🇨🇳', chatFrequency: 12, supportDays: 267, lastVisitDaysAgo: 1 },
  { id: 'v39', username: 'maria_pt', displayName: 'Maria Ferreira', level: 30, avatar: 'https://i.pravatar.cc/100?img=54', country: '🇵🇹', chatFrequency: 11, supportDays: 93, lastVisitDaysAgo: 3 },
  { id: 'v40', username: 'ethan.j', displayName: 'Ethan Johnson', level: 4, avatar: 'https://i.pravatar.cc/100?img=55', country: '🇺🇸', chatFrequency: 35, supportDays: 1, lastVisitDaysAgo: 14 },
  { id: 'v41', username: 'noor_eg', displayName: 'Noor Ibrahim', level: 46, avatar: 'https://i.pravatar.cc/100?img=56', country: '🇪🇬', chatFrequency: 9, supportDays: 210, lastVisitDaysAgo: 0 },
  { id: 'v42', username: 'anna.pol', displayName: 'Anna Kowalska', level: 32, avatar: 'https://i.pravatar.cc/100?img=57', country: '🇵🇱', chatFrequency: 13, supportDays: 104, lastVisitDaysAgo: 1 },
  { id: 'v43', username: 'ryu_kr', displayName: 'Ryu Ji-hoon', level: 59, avatar: 'https://i.pravatar.cc/100?img=58', country: '🇰🇷', chatFrequency: 6, supportDays: 301, lastVisitDaysAgo: 0 },
  { id: 'v44', username: 'jessica.au', displayName: 'Jessica Park', level: 21, avatar: 'https://i.pravatar.cc/100?img=59', country: '🇦🇺', chatFrequency: 14, supportDays: 62, lastVisitDaysAgo: 4 },
  { id: 'v45', username: 'omar_ma', displayName: 'Omar Benali', level: 35, avatar: 'https://i.pravatar.cc/100?img=60', country: '🇲🇦', chatFrequency: 10, supportDays: 118, lastVisitDaysAgo: 0 },
  { id: 'v46', username: 'eva.hrv', displayName: 'Eva Horvat', level: 17, avatar: 'https://i.pravatar.cc/100?img=61', country: '🇭🇷', chatFrequency: 20, supportDays: 19, lastVisitDaysAgo: 6 },
  { id: 'v47', username: 'brandon_tx', displayName: 'Brandon Lee', level: 43, avatar: 'https://i.pravatar.cc/100?img=62', country: '🇺🇸', chatFrequency: 8, supportDays: 183, lastVisitDaysAgo: 0 },
  { id: 'v48', username: 'ines.pt', displayName: 'Inês Costa', level: 26, avatar: 'https://i.pravatar.cc/100?img=63', country: '🇵🇹', chatFrequency: 12, supportDays: 76, lastVisitDaysAgo: 1 },
  { id: 'v49', username: 'andrei_md', displayName: 'Andrei Moraru', level: 40, avatar: 'https://i.pravatar.cc/100?img=64', country: '🇲🇩', chatFrequency: 9, supportDays: 155, lastVisitDaysAgo: 0 },
  { id: 'v50', username: 'maya.id', displayName: 'Maya Putri', level: 13, avatar: 'https://i.pravatar.cc/100?img=65', country: '🇮🇩', chatFrequency: 16, supportDays: 27, lastVisitDaysAgo: 5 },
  { id: 'v51', username: 'gabriel_co', displayName: 'Gabriel Rojas', level: 57, avatar: 'https://i.pravatar.cc/100?img=66', country: '🇨🇴', chatFrequency: 7, supportDays: 284, lastVisitDaysAgo: 0 },
  { id: 'v52', username: 'hana.jp', displayName: 'Hana Yamamoto', level: 69, avatar: 'https://i.pravatar.cc/100?img=67', country: '🇯🇵', chatFrequency: 5, supportDays: 378, lastVisitDaysAgo: 0 },
  { id: 'v53', username: 'mihai_ro', displayName: 'Mihai Dragomir', level: 24, avatar: 'https://i.pravatar.cc/100?img=68', country: '🇷🇴', chatFrequency: 11, supportDays: 63, lastVisitDaysAgo: 1 },
  { id: 'v54', username: 'aisha_ng', displayName: 'Aisha Okafor', level: 36, avatar: 'https://i.pravatar.cc/100?img=69', country: '🇳🇬', chatFrequency: 10, supportDays: 131, lastVisitDaysAgo: 0 },
  { id: 'v55', username: 'felix.de', displayName: 'Felix Schmidt', level: 9, avatar: 'https://i.pravatar.cc/100?img=70', country: '🇩🇪', chatFrequency: 24, supportDays: 8, lastVisitDaysAgo: 9 },
  { id: 'v56', username: 'luna_cl', displayName: 'Luna Vargas', level: 47, avatar: 'https://i.pravatar.cc/100?u=luna_cl', country: '🇨🇱', chatFrequency: 8, supportDays: 215, lastVisitDaysAgo: 0 },
  { id: 'v57', username: 'max.uk', displayName: 'Max Williams', level: 12, avatar: 'https://i.pravatar.cc/100?u=max_uk', country: '🇬🇧', chatFrequency: 18, supportDays: 21, lastVisitDaysAgo: 3 },
  { id: 'v58', username: 'selin_tr', displayName: 'Selin Yılmaz', level: 53, avatar: 'https://i.pravatar.cc/100?u=selin_tr', country: '🇹🇷', chatFrequency: 7, supportDays: 247, lastVisitDaysAgo: 0 },
  { id: 'v59', username: 'leo.bsas', displayName: 'Leo Fernández', level: 28, avatar: 'https://i.pravatar.cc/100?u=leo_bsas', country: '🇦🇷', chatFrequency: 13, supportDays: 77, lastVisitDaysAgo: 2 },
  { id: 'v60', username: 'naomi.ke', displayName: 'Naomi Wanjiku', level: 38, avatar: 'https://i.pravatar.cc/100?u=naomi_ke', country: '🇰🇪', chatFrequency: 11, supportDays: 149, lastVisitDaysAgo: 1 },
  { id: 'v61', username: 'daniel_ie', displayName: 'Daniel Murphy', level: 7, avatar: 'https://i.pravatar.cc/100?u=daniel_ie', country: '🇮🇪', chatFrequency: 28, supportDays: 5, lastVisitDaysAgo: 12 },
  { id: 'v62', username: 'thao.vn', displayName: 'Thao Nguyen', level: 62, avatar: 'https://i.pravatar.cc/100?u=thao_vn', country: '🇻🇳', chatFrequency: 6, supportDays: 319, lastVisitDaysAgo: 0 },
  { id: 'v63', username: 'adam_pl', displayName: 'Adam Wiśniewski', level: 19, avatar: 'https://i.pravatar.cc/100?u=adam_pl', country: '🇵🇱', chatFrequency: 15, supportDays: 38, lastVisitDaysAgo: 4 },
  { id: 'v64', username: 'zoe.nyc', displayName: 'Zoe Harper', level: 75, avatar: 'https://i.pravatar.cc/100?u=zoe_nyc', country: '🇺🇸', chatFrequency: 5, supportDays: 445, lastVisitDaysAgo: 0 },
  { id: 'v65', username: 'ivan_bg', displayName: 'Ivan Petrov', level: 31, avatar: 'https://i.pravatar.cc/100?u=ivan_bg', country: '🇧🇬', chatFrequency: 14, supportDays: 102, lastVisitDaysAgo: 1 },
  { id: 'v66', username: 'sakura_jp', displayName: 'Sakura Ito', level: 56, avatar: 'https://i.pravatar.cc/100?u=sakura_jp', country: '🇯🇵', chatFrequency: 7, supportDays: 273, lastVisitDaysAgo: 0 },
  { id: 'v67', username: 'carlos.mx', displayName: 'Carlos Mendoza', level: 22, avatar: 'https://i.pravatar.cc/100?u=carlos_mx', country: '🇲🇽', chatFrequency: 12, supportDays: 56, lastVisitDaysAgo: 3 },
  { id: 'v68', username: 'julia.at', displayName: 'Julia Steiner', level: 40, avatar: 'https://i.pravatar.cc/100?u=julia_at', country: '🇦🇹', chatFrequency: 10, supportDays: 164, lastVisitDaysAgo: 0 },
  { id: 'v69', username: 'rashid_ae', displayName: 'Rashid Al-Maktoum', level: 82, avatar: 'https://i.pravatar.cc/100?u=rashid_ae', country: '🇦🇪', chatFrequency: 6, supportDays: 510, lastVisitDaysAgo: 0 },
  { id: 'v70', username: 'bianca.ro', displayName: 'Bianca Ionescu', level: 29, avatar: 'https://i.pravatar.cc/100?u=bianca_ro', country: '🇷🇴', chatFrequency: 9, supportDays: 88, lastVisitDaysAgo: 1 },
  { id: 'v71', username: 'tom_nz', displayName: 'Tom Mitchell', level: 15, avatar: 'https://i.pravatar.cc/100?u=tom_nz', country: '🇳🇿', chatFrequency: 20, supportDays: 18, lastVisitDaysAgo: 7 },
  { id: 'v72', username: 'alina.ua', displayName: 'Alina Kovalenko', level: 44, avatar: 'https://i.pravatar.cc/100?u=alina_ua', country: '🇺🇦', chatFrequency: 8, supportDays: 195, lastVisitDaysAgo: 0 },
  { id: 'v73', username: 'ryan_sg', displayName: 'Ryan Lim', level: 33, avatar: 'https://i.pravatar.cc/100?u=ryan_sg', country: '🇸🇬', chatFrequency: 13, supportDays: 110, lastVisitDaysAgo: 2 },
  { id: 'v74', username: 'clara.es', displayName: 'Clara Hernández', level: 51, avatar: 'https://i.pravatar.cc/100?u=clara_es', country: '🇪🇸', chatFrequency: 7, supportDays: 253, lastVisitDaysAgo: 0 },
  { id: 'v75', username: 'arjun.in', displayName: 'Arjun Reddy', level: 26, avatar: 'https://i.pravatar.cc/100?u=arjun_in', country: '🇮🇳', chatFrequency: 11, supportDays: 69, lastVisitDaysAgo: 1 },
  { id: 'v76', username: 'sophie_ch', displayName: 'Sophie Keller', level: 18, avatar: 'https://i.pravatar.cc/100?u=sophie_ch', country: '🇨🇭', chatFrequency: 16, supportDays: 32, lastVisitDaysAgo: 5 },
  { id: 'v77', username: 'kofi.gh', displayName: 'Kofi Asante', level: 43, avatar: 'https://i.pravatar.cc/100?u=kofi_gh', country: '🇬🇭', chatFrequency: 10, supportDays: 178, lastVisitDaysAgo: 0 },
  { id: 'v78', username: 'victoria_se', displayName: 'Victoria Holm', level: 60, avatar: 'https://i.pravatar.cc/100?u=victoria_se', country: '🇸🇪', chatFrequency: 6, supportDays: 330, lastVisitDaysAgo: 0 },
  { id: 'v79', username: 'pedro.br', displayName: 'Pedro Oliveira', level: 35, avatar: 'https://i.pravatar.cc/100?u=pedro_br', country: '🇧🇷', chatFrequency: 9, supportDays: 121, lastVisitDaysAgo: 1 },
  { id: 'v80', username: 'nadia_dz', displayName: 'Nadia Benmoussa', level: 49, avatar: 'https://i.pravatar.cc/100?u=nadia_dz', country: '🇩🇿', chatFrequency: 8, supportDays: 222, lastVisitDaysAgo: 0 },
  { id: 'v81', username: 'finn.no', displayName: 'Finn Johansen', level: 14, avatar: 'https://i.pravatar.cc/100?u=finn_no', country: '🇳🇴', chatFrequency: 22, supportDays: 11, lastVisitDaysAgo: 6 },
  { id: 'v82', username: 'mei_tw', displayName: 'Mei-Ling Wu', level: 66, avatar: 'https://i.pravatar.cc/100?u=mei_tw', country: '🇹🇼', chatFrequency: 6, supportDays: 356, lastVisitDaysAgo: 0 },
  { id: 'v83', username: 'stefan.rs', displayName: 'Stefan Jovanović', level: 27, avatar: 'https://i.pravatar.cc/100?u=stefan_rs', country: '🇷🇸', chatFrequency: 13, supportDays: 74, lastVisitDaysAgo: 2 },
  { id: 'v84', username: 'leila.lb', displayName: 'Leila Khoury', level: 41, avatar: 'https://i.pravatar.cc/100?u=leila_lb', country: '🇱🇧', chatFrequency: 9, supportDays: 169, lastVisitDaysAgo: 0 },
  { id: 'v85', username: 'ashley_ca', displayName: 'Ashley Nguyen', level: 20, avatar: 'https://i.pravatar.cc/100?u=ashley_ca', country: '🇨🇦', chatFrequency: 14, supportDays: 43, lastVisitDaysAgo: 3 },
  { id: 'v86', username: 'hugo.fr', displayName: 'Hugo Laurent', level: 37, avatar: 'https://i.pravatar.cc/100?u=hugo_fr', country: '🇫🇷', chatFrequency: 11, supportDays: 137, lastVisitDaysAgo: 1 },
  { id: 'v87', username: 'daria.ro', displayName: 'Daria Munteanu', level: 55, avatar: 'https://i.pravatar.cc/100?u=daria_ro', country: '🇷🇴', chatFrequency: 7, supportDays: 261, lastVisitDaysAgo: 0 },
  { id: 'v88', username: 'josh_us', displayName: 'Josh Anderson', level: 3, avatar: 'https://i.pravatar.cc/100?u=josh_us', country: '🇺🇸', chatFrequency: 40, supportDays: 2, lastVisitDaysAgo: 15 },
  { id: 'v89', username: 'mila.hr', displayName: 'Mila Kovačević', level: 46, avatar: 'https://i.pravatar.cc/100?u=mila_hr', country: '🇭🇷', chatFrequency: 8, supportDays: 207, lastVisitDaysAgo: 0 },
  { id: 'v90', username: 'ravi_in', displayName: 'Ravi Kumar', level: 32, avatar: 'https://i.pravatar.cc/100?u=ravi_in', country: '🇮🇳', chatFrequency: 12, supportDays: 96, lastVisitDaysAgo: 1 },
  { id: 'v91', username: 'kim_ph', displayName: 'Kim Santos', level: 24, avatar: 'https://i.pravatar.cc/100?u=kim_ph', country: '🇵🇭', chatFrequency: 10, supportDays: 59, lastVisitDaysAgo: 4 },
  { id: 'v92', username: 'laura.it', displayName: 'Laura Conti', level: 63, avatar: 'https://i.pravatar.cc/100?u=laura_it', country: '🇮🇹', chatFrequency: 6, supportDays: 342, lastVisitDaysAgo: 0 },
  { id: 'v93', username: 'ben_za', displayName: 'Ben Nkosi', level: 39, avatar: 'https://i.pravatar.cc/100?u=ben_za', country: '🇿🇦', chatFrequency: 11, supportDays: 150, lastVisitDaysAgo: 0 },
  { id: 'v94', username: 'katya.ru', displayName: 'Katya Smirnova', level: 70, avatar: 'https://i.pravatar.cc/100?u=katya_ru', country: '🇷🇺', chatFrequency: 5, supportDays: 390, lastVisitDaysAgo: 0 },
  { id: 'v95', username: 'lucas_nl', displayName: 'Lucas de Vries', level: 16, avatar: 'https://i.pravatar.cc/100?u=lucas_nl', country: '🇳🇱', chatFrequency: 18, supportDays: 25, lastVisitDaysAgo: 8 },
  { id: 'v96', username: 'yara.sa', displayName: 'Yara Al-Rashid', level: 52, avatar: 'https://i.pravatar.cc/100?u=yara_sa', country: '🇸🇦', chatFrequency: 8, supportDays: 238, lastVisitDaysAgo: 0 },
  { id: 'v97', username: 'chris.nz', displayName: 'Chris Thompson', level: 11, avatar: 'https://i.pravatar.cc/100?u=chris_nz', country: '🇳🇿', chatFrequency: 25, supportDays: 14, lastVisitDaysAgo: 10 },
  { id: 'v98', username: 'ana.bg', displayName: 'Ana Dimitrova', level: 45, avatar: 'https://i.pravatar.cc/100?u=ana_bg', country: '🇧🇬', chatFrequency: 9, supportDays: 186, lastVisitDaysAgo: 0 },
  { id: 'v99', username: 'malik_pk', displayName: 'Malik Hassan', level: 34, avatar: 'https://i.pravatar.cc/100?u=malik_pk', country: '🇵🇰', chatFrequency: 12, supportDays: 107, lastVisitDaysAgo: 2 },
  { id: 'v100', username: 'celine.be', displayName: 'Céline Dubois', level: 58, avatar: 'https://i.pravatar.cc/100?u=celine_be', country: '🇧🇪', chatFrequency: 7, supportDays: 289, lastVisitDaysAgo: 0 },
] : []; // Empty in production — no fake viewers

// Realistic chat messages - hyper diverse, natural language with typos, slang, abbreviations
const CHAT_MESSAGES = {
  greeting: [],
  reaction: [],
  question: [],
  compliment: [],
  general: [],
  emoji: [],
  gift_reaction: [],
  gift_encourage: [],
  reply_style: [],
  streamer_talk: [],
  viewer_to_viewer: [],
};

// Track recently used messages to avoid repetition
const recentMessagesRef: string[] = [];
const MAX_RECENT = 50;
// Track recent chat usernames for viewer-to-viewer replies
const recentChattersRef: string[] = [];

const getRandomChatMessage = (
  viewer: Omit<SimulatedViewer, 'joinedAt' | 'isActive'>,
  isFirstMessage = false,
  context: 'normal' | 'gift_reaction' | 'gift_encourage' | 'streamer' = 'normal'
): string => {
  const categories = Object.keys(CHAT_MESSAGES) as (keyof typeof CHAT_MESSAGES)[];
  // categories: greeting(0), reaction(1), question(2), compliment(3), general(4), emoji(5),
  //             gift_reaction(6), gift_encourage(7), reply_style(8), streamer_talk(9), viewer_to_viewer(10)
  
  let weights: number[];
  if (isFirstMessage) {
    weights = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  } else if (context === 'gift_reaction') {
    weights = [0, 5, 0, 0, 0, 10, 70, 5, 10, 0, 0];
  } else if (context === 'gift_encourage') {
    weights = [0, 0, 0, 0, 5, 5, 5, 75, 5, 0, 5];
  } else if (context === 'streamer') {
    weights = [0, 5, 10, 15, 5, 0, 0, 0, 5, 55, 5];
  } else {
    // Normal chat - all zeros because no mock messages exist
    weights = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return ''; // No messages to send
  let r = Math.random() * totalWeight;
  let categoryIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) { categoryIndex = i; break; }
  }
  const category = categories[categoryIndex];
  const msgs = CHAT_MESSAGES[category] || []; // Fallback to empty array if undefined
  
  if (!msgs || msgs.length === 0) return ''; // Return empty string if no messages available

  // Try to pick a message that hasn't been used recently
  let msg = '';
  let attempts = 0;
  do {
    msg = msgs[Math.floor(Math.random() * msgs.length)];
    attempts++;
  } while (recentMessagesRef.includes(msg) && attempts < 6);
  
  if (!msg) return '';

  // Track recent messages
  recentMessagesRef.push(msg);
  if (recentMessagesRef.length > MAX_RECENT) recentMessagesRef.shift();
  
  // Replace {country} placeholder
  msg = msg.replace('{country}', viewer.country);
  
  // Replace {viewer} with a recent chatter's name (for viewer-to-viewer)
  if (msg.includes('{viewer}')) {
    const otherChatters = recentChattersRef.filter(n => n !== viewer.displayName);
    if (otherChatters.length > 0) {
      const target = otherChatters[Math.floor(Math.random() * otherChatters.length)];
      msg = msg.replace(/\{viewer\}/g, target);
    } else {
      // No recent chatters, fall back to a generic reaction
      const fallbacks = CHAT_MESSAGES.reaction || [];
      if (fallbacks.length > 0) {
          msg = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      } else {
          msg = "Wow!";
      }
    }
  }
  
  // Random lowercase variation for realism (8% chance)
  if (Math.random() < 0.08 && !msg.includes('🇺🇸') && !msg.includes('🇬🇧')) {
    msg = msg.toLowerCase();
  }
  
  // Track this viewer as a recent chatter
  recentChattersRef.push(viewer.displayName);
  if (recentChattersRef.length > 15) recentChattersRef.shift();
  
  return msg;
};



export default function LiveStream() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const opponentVideoRef = useRef<HTMLVideoElement>(null);
  const player3VideoRef = useRef<HTMLVideoElement>(null);
  const player4VideoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const setPromo = useLivePromoStore((s) => s.setPromo);
  const updateUser = useAuthStore((s) => s.updateUser);
  const effectiveStreamId = streamId || 'broadcast';
  const PROMOTE_LIKES_THRESHOLD_LIVE = 100;
  const _PROMOTE_LIKES_THRESHOLD_BATTLE = 50;
  
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showRankingPanel, setShowRankingPanel] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const giftPanelOpenedAtRef = useRef(0);
  const _openGiftPanel = useCallback(() => {
    giftPanelOpenedAtRef.current = Date.now();
    setShowGiftPanel(true);
  }, []);
  const _closeGiftPanel = useCallback(() => {
    setShowGiftPanel(false);
  }, []);
  const [currentGift, setCurrentGift] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const isBroadcast = streamId === 'broadcast';
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [coinPassword, setCoinPassword] = useState('');
  const [showViewerList, setShowViewerList] = useState(false);


  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isLiveSettingsOpen, setIsLiveSettingsOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState(Math.floor(Math.random() * 500) + 50);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const user = useAuthStore((s) => s.user);
  const formatStreamName = (id: string) =>
    id
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const creatorName = isBroadcast
    ? user?.name || user?.username || 'Andrei Ionut Berica'
    : streamId
      ? formatStreamName(streamId)
      : 'ELIX STAR';
  const myCreatorName = creatorName;
  const myAvatar = isBroadcast
    ? user?.avatar || `https://i.pravatar.cc/150?u=young_creator_2026`
    : `https://i.pravatar.cc/150?u=young_creator_2026`;
  const [opponentCreatorName, setOpponentCreatorName] = useState('Paul');
  const viewerName = user?.username || user?.name || 'viewer_123';
  const viewerAvatar =
    user?.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(viewerName)}`;
  const universeGiftLabel = 'Universe';

  // FaceAR State
  const faceARCanvasRef = useRef<HTMLCanvasElement>(null);
  const [_faceARVideoEl, setFaceARVideoEl] = useState<HTMLVideoElement | null>(null);
  const [_faceARCanvasEl, setFaceARCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [_battleGiftIconFailed, _setBattleGiftIconFailed] = useState(false);

  // Handle keyboard/viewport resizing for Viewer List
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // Calculate the part of the height covered by keyboard (or other UI)
        // This handles both iOS (keyboard overlay) and Android (resize) nuances
        const height = window.innerHeight - window.visualViewport.height;
        // Only apply if significant (keyboard likely open)
        const offset = height > 0 ? height : 0;
        document.documentElement.style.setProperty('--kb-height', `${offset}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize(); // Initial check
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Auto-close Viewer List after 10 seconds of inactivity
  useEffect(() => {
    if (showViewerList) {
      const timer = setTimeout(() => {
        setShowViewerList(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showViewerList]);

  useEffect(() => {
    if (videoRef.current) setFaceARVideoEl(videoRef.current);
    if (faceARCanvasRef.current) setFaceARCanvasEl(faceARCanvasRef.current);
  }, [isBroadcast]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const run = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('coins,level,xp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled && data?.coins != null) {
        setCoinBalance(Number(data.coins));
        if (data.level != null) setUserLevel(Number(data.level));
        if (data.xp != null) setUserXP(Number(data.xp));
        if (data.level != null) updateUser({ level: Number(data.level) });
      }

      if (error) {
        return;
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: user.id, coins: 0, level: 1, xp: 0 });

      if (insertError) {
        const code = (insertError as unknown as { code?: string }).code;
        const msg = insertError.message.toLowerCase();
        if (code !== '23505' && !msg.includes('duplicate') && !msg.includes('already exists')) {
          return;
        }
      }
      const retry = await supabase
        .from('profiles')
        .select('coins,level,xp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled && retry.data?.coins != null) {
        setCoinBalance(Number(retry.data.coins));
        if (retry.data.level != null) setUserLevel(Number(retry.data.level));
        if (retry.data.xp != null) setUserXP(Number(retry.data.xp));
        if (retry.data.level != null) updateUser({ level: Number(retry.data.level) });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [updateUser, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const key = effectiveStreamId;
    if (!key) return;

    (async () => {
      const { error } = await supabase.from('live_streams').upsert(
        {
          stream_key: key,
          user_id: user.id,
          title: creatorName,
          is_live: true,
        },
        { onConflict: 'stream_key' }
      );
      if (error) {
        console.warn('Live status update failed:', error.message);
      }
    })();
    return () => {
      supabase
        .from('live_streams')
        .update({ is_live: false, viewer_count: 0 })
        .eq('stream_key', key)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            console.warn('Live status clear failed:', error.message);
          }
        });
    };
  }, [creatorName, effectiveStreamId, user?.id]);

  // Refresh coins when gift panel opens to ensure balance is up to date
  useEffect(() => {
    if (showGiftPanel && user?.id) {
      supabase
        .from('profiles')
        .select('coins')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.coins != null) {
            setCoinBalance(Number(data.coins));
          }
        });
    }
  }, [showGiftPanel, user?.id]);

  useEffect(() => {
    if (user?.id && effectiveStreamId) {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `joined_stream_${effectiveStreamId}_${user.id}_${today}`;
      const hasJoined = localStorage.getItem(storageKey);
      if (hasJoined) {
        setHasJoinedToday(true);
      }
      
      // Load total heart count
      const heartKey = `my_heart_count_${effectiveStreamId}_${user.id}`;
      const savedHearts = localStorage.getItem(heartKey);
      if (savedHearts) {
        setMyHeartCount(parseInt(savedHearts, 10));
      }
    }
  }, [user?.id, effectiveStreamId]);

  const [isFindCreatorsOpen, setIsFindCreatorsOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [hasJoinedToday, setHasJoinedToday] = useState(false);
  const [myHeartCount, setMyHeartCount] = useState(0);
  const [creatorQuery, setCreatorQuery] = useState('');

  const creators = [
    { id: 'c1', name: 'Paul', followers: '1.2M' },
    { id: 'c2', name: 'Maria Pop', followers: '842K' },
    { id: 'c3', name: 'John Live', followers: '510K' },
    { id: 'c4', name: 'Alex Cool', followers: '2.1M' },
    { id: 'c5', name: 'Sarah J', followers: '976K' },
  ];

  const filteredCreators = creators.filter((c) => c.name.toLowerCase().includes(creatorQuery.trim().toLowerCase()));

  // Battle Player Slots (P1 = creator, P2-P4 = invited players)
  type BattleSlot = { name: string; status: 'empty' | 'invited' | 'accepted'; avatar: string };
  const [battleSlots, setBattleSlots] = useState<BattleSlot[]>([
    { name: '', status: 'empty', avatar: '' },
    { name: '', status: 'empty', avatar: '' },
    { name: '', status: 'empty', avatar: '' },
  ]);
  const inviteTimersRef = useRef<NodeJS.Timeout[]>([]);

  const inviteCreatorToSlot = (creatorName: string) => {
    // Find first empty slot
    const slotIndex = battleSlots.findIndex(s => s.status === 'empty');
    if (slotIndex === -1) return; // All slots full
    // Check if already invited
    if (battleSlots.some(s => s.name === creatorName && s.status !== 'empty')) return;

    const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(creatorName)}`;
    setBattleSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { name: creatorName, status: 'invited', avatar };
      return next;
    });

    // Simulate acceptance after 2-4 seconds
    const delay = 2000 + Math.random() * 2000;
    const timer = setTimeout(() => {
      setBattleSlots(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => s.name === creatorName && s.status === 'invited');
        if (idx !== -1) {
          next[idx] = { ...next[idx], status: 'accepted' };
        }
        return next;
      });
    }, delay);
    inviteTimersRef.current.push(timer);
  };

  // Mute state per player pane
  const [mutedPlayers, setMutedPlayers] = useState<Record<string, boolean>>({});
  const togglePlayerMute = (player: string) => {
    setMutedPlayers(prev => ({ ...prev, [player]: !prev[player] }));
  };

  const removePlayerFromSlot = (slotIndex: number) => {
    setBattleSlots(prev => {
      const next = [...prev];
      next[slotIndex] = { name: '', status: 'empty', avatar: '' };
      return next;
    });
  };

  const filledSlots = battleSlots.filter(s => s.status !== 'empty');
  const allFilledAccepted = filledSlots.length > 0 && filledSlots.every(s => s.status === 'accepted');
  const anySlotFilled = filledSlots.length > 0;
  const _allSlotsAccepted = allFilledAccepted;

  // Battle Mode State
  const [isBattleMode, setIsBattleMode] = useState(false);
  const [battleTime, setBattleTime] = useState(300); // 5 minutes
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [player3Score, setPlayer3Score] = useState(0);
  const [player4Score, setPlayer4Score] = useState(0);
  const [battleWinner, setBattleWinner] = useState<'me' | 'opponent' | 'player3' | 'player4' | 'draw' | null>(null);
  const [giftTarget, setGiftTarget] = useState<'me' | 'opponent' | 'player3' | 'player4'>('me');
  const lastScreenTapRef = useRef<number>(0);
  const battleScoreTapWindowRef = useRef<{ windowStart: number; count: number }>({ windowStart: 0, count: 0 });
  const lastBattleTapTimeRef = useRef<number>(0);
  const battleFreeTapUsedRef = useRef<boolean>(false);
  const battleTripleTapRef = useRef<{ target: 'me' | 'opponent' | null; lastTapAt: number; count: number }>({
    target: null,
    lastTapAt: 0,
    count: 0,
  });
  const [battleCountdown, setBattleCountdown] = useState<number | null>(null);
  const _battleKeyboardLikeArmedRef = useRef(true);
  const [liveLikes, setLiveLikes] = useState(0);
  const [battleReadiness, setBattleReadiness] = useState(0);

  // Speed Challenge State
  // SPEED CHALLENGE
  const SPEED_CHALLENGE_ENABLED = true;
  const [speedChallengeActive, setSpeedChallengeActive] = useState(false);
  const [speedChallengeCountdown, setSpeedChallengeCountdown] = useState<number | null>(null); // 3,2,1 before start
  const [speedChallengeTime, setSpeedChallengeTime] = useState(10); // 10 seconds
  const [speedChallengeTaps, setSpeedChallengeTaps] = useState<Record<string, number>>({ me: 0, opponent: 0, player3: 0, player4: 0 });
  const speedChallengeTapsRef = useRef<Record<string, number>>({ me: 0, opponent: 0, player3: 0, player4: 0 });
  const [speedChallengeResult, setSpeedChallengeResult] = useState<string | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const speedChallengeActiveRef = useRef(false);
  const speedMultiplierRef = useRef(1);
  const roseCountRef = useRef(0);
  const [roseCount, setRoseCount] = useState(0);

  useEffect(() => { speedChallengeActiveRef.current = speedChallengeActive; }, [speedChallengeActive]);
  useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);

  const speedChallengeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeedChallengeRef = useRef<number>(0);
  const reachedThresholdsRef = useRef<Set<number>>(new Set());
  const [_battleGifterCoins, setBattleGifterCoins] = useState<Record<string, number>>({});
  // Track top gifters per player: { 'me': { 'username': coins }, 'opponent': {...}, ... }
  const [playerGifters, setPlayerGifters] = useState<Record<string, Record<string, number>>>({});
  const [lastGifts, setLastGifts] = useState<{ opponent: string | null; player3: string | null; player4: string | null }>({ opponent: null, player3: null, player4: null });
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: string; x: number; y: number; dx: number; rot: number; size: number; color: string; username?: string; avatar?: string }>
  >([]);
  const [miniProfile, setMiniProfile] = useState<null | { username: string; avatar: string; level: number | null; coins?: number; donated?: number }>(null);
  const [showMembershipBar, setShowMembershipBar] = useState(false);
  const [showTeamStatus, setShowTeamStatus] = useState(false);
  const [showJoinAnimation, setShowJoinAnimation] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [membershipHeartActive, setMembershipHeartActive] = useState(false);
  const membershipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // FAN CLUB PANEL - removed top bar, now using Sheet
  const [showFanClub, setShowFanClub] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    // Immediate feedback - force the button to work visually first
    console.log('Subscribe button clicked');
    setIsSubscribing(true);

    // Simulate delay for effect
    setTimeout(() => {
        setIsSubscribing(false);
        // Show success directly without relying on complex backend logic for now
        alert('Redirecting to Stripe Checkout for £3.00 subscription...');
        // In a real scenario, this would be: window.location.href = result.url;
    }, 1000);
  };

  // Auto-close Fan Club after 10 seconds of inactivity
  useEffect(() => {
    if (showFanClub) {
      const timer = setTimeout(() => {
        setShowFanClub(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showFanClub]);

  const closeMembershipBar = useCallback(() => {
    // setMembershipBarClosing(true);
    // setTimeout(() => { setShowMembershipBar(false); setMembershipBarClosing(false); }, 200);
  }, []);

  const openMembershipBar = useCallback(() => {
    if (membershipTimerRef.current) clearTimeout(membershipTimerRef.current);
    // Instead of opening the top bar, we now open the bottom sheet Fan Club
    setShowFanClub(true);
  }, [closeMembershipBar]);
  const [sessionContribution, setSessionContribution] = useState(0); // total coins gifted this session
  const [universeQueue, setUniverseQueue] = useState<UniverseTickerMessage[]>([]);
  const [currentUniverse, setCurrentUniverse] = useState<UniverseTickerMessage | null>(null);

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareQuery, setShareQuery] = useState('');

  // 2v2: Red Team (P1+P3) vs Blue Team (P2+P4)
  const determine4PlayerWinner = useCallback(() => {
    const red = myScore + player3Score;
    const blue = opponentScore + player4Score;
    if (red === blue) return 'draw';
    // 'me' = red team wins, 'opponent' = blue team wins
    return red > blue ? 'me' : 'opponent';
  }, [myScore, opponentScore, player3Score, player4Score]);

  useEffect(() => {
    if (!isBattleMode || battleTime <= 0) return;
    const interval = setInterval(() => {
      setBattleTime(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
      // Simulate opponent scores (outside setBattleTime updater)
      if (Math.random() > 0.7) {
        setOpponentScore(s => s + Math.floor(Math.random() * 50));
        if (Math.random() > 0.6) {
           const randomGift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
           setLastGifts(prev => ({ ...prev, opponent: randomGift.icon }));
        }
      }
      if (Math.random() > 0.7) {
        setPlayer3Score(s => s + Math.floor(Math.random() * 40));
        if (Math.random() > 0.6) {
           const randomGift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
           setLastGifts(prev => ({ ...prev, player3: randomGift.icon }));
        }
      }
      if (Math.random() > 0.7) {
        setPlayer4Score(s => s + Math.floor(Math.random() * 45));
        if (Math.random() > 0.6) {
           const randomGift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
           setLastGifts(prev => ({ ...prev, player4: randomGift.icon }));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isBattleMode, battleTime]);

  // Determine winner when battle time reaches 0
  useEffect(() => {
    if (isBattleMode && battleTime === 0 && !battleWinner && battleCountdown === null) {
      // Only determine winner if the battle was actually started (scores exist)
      const totalScore = myScore + opponentScore + player3Score + player4Score;
      if (totalScore > 0) {
        const winner = determine4PlayerWinner();
        setBattleWinner(winner);
      }
    }
  }, [isBattleMode, battleTime, battleWinner, battleCountdown, myScore, opponentScore, player3Score, player4Score, determine4PlayerWinner]);

  const toggleBattle = useCallback(() => {
    if (isBattleMode) {
      setIsBattleMode(false);
      setBattleTime(300);
      setBattleWinner(null);
      setBattleCountdown(null);
      reachedThresholdsRef.current.clear();
      battleFreeTapUsedRef.current = false;
      battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
      battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
      setMiniProfile(null);
      // Reset speed challenge
      setSpeedChallengeActive(false);
      setSpeedChallengeCountdown(null);
      setSpeedChallengeTime(10);
      setSpeedChallengeTaps({ me: 0, opponent: 0, player3: 0, player4: 0 });
      setSpeedChallengeResult(null);
      setSpeedMultiplier(1);
      // Reset invite slots
      setBattleSlots([
        { name: '', status: 'empty', avatar: '' },
        { name: '', status: 'empty', avatar: '' },
        { name: '', status: 'empty', avatar: '' },
      ]);
      inviteTimersRef.current.forEach(t => clearTimeout(t));
      inviteTimersRef.current = [];
      return;
    }
    // Enter battle mode but DON'T start countdown yet - wait for invites
    setIsBattleMode(true);
    setBattleTime(0);
    setMyScore(0);
    setOpponentScore(0);
    setPlayer3Score(0);
    setPlayer4Score(0);
    setBattleWinner(null);
    setGiftTarget('me');
    setShowGiftPanel(false);
    setBattleGifterCoins({});
    setPlayerGifters({});
    setBattleCountdown(null); // Don't start countdown until all accept
    battleFreeTapUsedRef.current = false;
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    battleTripleTapRef.current = { target: null, lastTapAt: 0, count: 0 };
    // Open invite panel
    setIsFindCreatorsOpen(true);
  }, [isBattleMode]);

  // No auto-start - user must press Match to begin

  useEffect(() => {
    if (!isBattleMode) return;
    if (battleCountdown == null) return;

    const tick = window.setInterval(() => {
      setBattleCountdown((prev) => {
        if (prev == null) return null;
        if (prev <= 1) {
          window.clearInterval(tick);
          setBattleTime(300);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isBattleMode, battleCountdown]);

  const _startBattleWithCreator = (creatorName: string) => {
    setOpponentCreatorName(creatorName);
    // If not in battle mode yet, enter it first
    if (!isBattleMode) {
      setIsBattleMode(true);
      setBattleTime(0);
      setMyScore(0);
      setOpponentScore(0);
      setPlayer3Score(0);
      setPlayer4Score(0);
      setBattleWinner(null);
      setGiftTarget('me');
      setShowGiftPanel(false);
      setBattleGifterCoins({});
      setBattleCountdown(null);
      const params = new URLSearchParams(location.search);
      params.set('battle', '1');
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    }
    // Invite the creator to a slot
    inviteCreatorToSlot(creatorName);
  };

  useEffect(() => {
    if (currentUniverse || universeQueue.length === 0) return;
    const next = universeQueue[0];
    setCurrentUniverse(next);
    setUniverseQueue((prev) => prev.slice(1));
  }, [currentUniverse, universeQueue]);

  // Auto-clear universe message after 8 seconds
  useEffect(() => {
    if (!currentUniverse) return;
    const timer = setTimeout(() => {
      setCurrentUniverse(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [currentUniverse]);

  const enqueueUniverse = (sender: string) => {
    const receiver = isBattleMode
      ? giftTarget === 'me'
      ? myCreatorName
      : opponentCreatorName
      : myCreatorName;

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setUniverseQueue((prev) => {
      const next = [...prev, { id, sender, receiver }];
      return next.slice(-12);
    });
  };

  const maybeEnqueueUniverse = (giftName: string, sender: string) => {
    if (!/univ/i.test(giftName)) return;
    enqueueUniverse(sender);
  };

  const addLiveLikes = useCallback((delta: number) => {
    if (delta <= 0) return;

    setLiveLikes((prev) => {
      const next = prev + delta;
      if (prev < PROMOTE_LIKES_THRESHOLD_LIVE && next >= PROMOTE_LIKES_THRESHOLD_LIVE) {
        setPromo({
          type: isBattleMode ? 'battle' : 'live',
          streamId: effectiveStreamId,
          likes: next,
          createdAt: Date.now(),
        });
      }
      return next;
    });
  }, [isBattleMode, effectiveStreamId, setPromo]);

  const awardBattlePoints = useCallback((target: 'me' | 'opponent' | 'player3' | 'player4', points: number, isSpeedTap?: boolean) => {
    if (!isBattleMode || battleTime <= 0 || battleWinner) return;
    
    const finalPoints = isSpeedTap && speedChallengeActiveRef.current ? points * speedMultiplierRef.current : points;
    
    if (target === 'me') {
      setMyScore((prev) => prev + finalPoints);
    } else if (target === 'opponent') {
      setOpponentScore((prev) => prev + finalPoints);
    } else if (target === 'player3') {
      setPlayer3Score((prev) => prev + finalPoints);
    } else {
      setPlayer4Score((prev) => prev + finalPoints);
    }
  }, [isBattleMode, battleTime, battleWinner]);

  const addBattleGifterCoins = (username: string, coins: number, target?: string) => {
    if (!isBattleMode) return;
    if (!username || coins <= 0) return;
    setBattleGifterCoins((prev) => ({ ...prev, [username]: (prev[username] ?? 0) + coins }));
    // Track per-player gifters
    const playerTarget = target || giftTarget;
    setPlayerGifters(prev => {
      const playerRecord = { ...(prev[playerTarget] || {}) };
      playerRecord[username] = (playerRecord[username] ?? 0) + coins;
      return { ...prev, [playerTarget]: playerRecord };
    });
  };

  // Get top 3 gifters for a player
  const getTopGifters = (player: string) => {
    const gifters = playerGifters[player] || {};
    return Object.entries(gifters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, coins]) => ({
        name,
        coins,
        avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`,
      }));
  };

  const formatCoinsShort = (coins: number) => {
    if (coins >= 1_000_000) {
      const m = Math.round((coins / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (coins >= 1000) {
      const k = Math.round((coins / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return coins.toLocaleString();
  };

  const formatCountShort = (count: number) => {
    if (count >= 1_000_000) {
      const m = Math.round((count / 1_000_000) * 10) / 10;
      const label = Number.isInteger(m) ? String(Math.trunc(m)) : String(m);
      return `${label}M`;
    }
    if (count >= 1000) {
      const k = Math.round((count / 1000) * 10) / 10;
      const label = Number.isInteger(k) ? String(Math.trunc(k)) : String(k);
      return `${label}K`;
    }
    return String(count);
  };

  const activeViewersRef = useRef<SimulatedViewer[]>([]);
  const spawnHeartAt = useCallback((x: number, y: number, colorOverride?: string, likerName?: string, likerAvatar?: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const dx = Math.round((Math.random() * 2 - 1) * 120);
    const rot = Math.round((Math.random() * 2 - 1) * 45);
    const size = Math.round(24 + Math.random() * 12);
    const colors = ['#FF0000', '#FF2D55', '#E60026', '#DC143C', '#FF1744', '#CC0000'];
    const color = colorOverride ?? colors[Math.floor(Math.random() * colors.length)];
    
    // Check if this is a membership heart (triggered by "Joined the team")
    const isMembership = likerName === 'You' && likerAvatar === 'https://i.pravatar.cc/150?img=68';

    // Pick a random viewer name if none provided
    let username = likerName;
    let avatar = likerAvatar;
    const viewers = activeViewersRef.current;
    if (!username && viewers.length > 0) {
      const randomViewer = viewers[Math.floor(Math.random() * viewers.length)];
      username = randomViewer.displayName;
      avatar = randomViewer.avatar;
    }

    setFloatingHearts((prev) => [...prev.slice(-40), { id, x, y, dx, rot, size, color, username, avatar, isMembership }]);
    window.setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, isMembership ? 2000 : 500); // Increased timeout for membership hearts
  }, []);

  const spawnHeartFromClient = (clientX: number, clientY: number, colorOverride?: string, likerName?: string, likerAvatar?: string) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    spawnHeartAt(clientX - rect.left, clientY - rect.top, colorOverride, likerName, likerAvatar);
  };

  const spawnHeartAtSide = useCallback((target: 'me' | 'opponent') => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = rect.width * (target === 'me' ? 0.25 : 0.75);
    const y = rect.height * 0.62;
    spawnHeartAt(x, y, '#FF2D55');
  }, [spawnHeartAt]);

  // Battle Tap Logic: 3 taps = 5 points
  const handleBattleTap = useCallback((target: 'me' | 'opponent' | 'player3' | 'player4') => {
    // Strict One-Tap Logic for Battle
    if (!isBattleMode || battleWinner || battleTime <= 0) return;

    setGiftTarget(target);

    // Speed Challenge - Unlimited Taps
    if (speedChallengeActive) {
      setSpeedChallengeTaps(prev => ({ ...prev, [target]: (prev[target] ?? 0) + 1 }));
      awardBattlePoints(target, 2, true);
      return;
    }

    // Normal Battle - Strict 1 Tap Limit for 5 Points
    if (battleFreeTapUsedRef.current) {
        console.log("Battle tap rejected: Already tapped.");
        return;
    }

    // Mark as tapped immediately
    battleFreeTapUsedRef.current = true;
    
    // Award exactly 5 points once
    console.log("Battle tap accepted: Awarding 5 points.");
    awardBattlePoints(target, 5, false); 

  }, [battleWinner, battleTime, speedChallengeActive, awardBattlePoints, isBattleMode]);

  // ─── SPEED CHALLENGE LOGIC ───
  const startSpeedChallenge = useCallback(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (speedChallengeActive || speedChallengeCountdown !== null || !isBattleMode || battleWinner) return;
    setSpeedChallengeTaps({ me: 0, opponent: 0, player3: 0, player4: 0 });
    setSpeedChallengeResult(null);
    // Only reset multiplier to 1 if it's not already set (e.g. by score threshold)
    setSpeedMultiplier(prev => prev > 1 ? prev : 1);
    setSpeedChallengeCountdown(3); // 3, 2, 1 countdown
  }, [speedChallengeActive, speedChallengeCountdown, isBattleMode, battleWinner, SPEED_CHALLENGE_ENABLED]);

  // Auto-start speed challenge when 10+ viewers are active, at ~90s intervals
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (!isBattleMode || battleWinner || battleTime <= 0) return;
    if (speedChallengeActive || speedChallengeCountdown !== null) return;
    const timeSinceLast = (300 - battleTime) - lastSpeedChallengeRef.current;
    const viewerCount = activeViewersRef.current.length;
    if (viewerCount >= 10 && timeSinceLast >= 60) {
      lastSpeedChallengeRef.current = 300 - battleTime;
      startSpeedChallenge();
    }
  }, [battleTime, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, startSpeedChallenge, SPEED_CHALLENGE_ENABLED]);

  // Also trigger at fixed moments: 3:00 and 2:00
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED) return; // Guard
    if (!isBattleMode || battleWinner) return;
    if (battleTime === 300 || battleTime === 120) {
      startSpeedChallenge();
    }
  }, [battleTime, isBattleMode, battleWinner, startSpeedChallenge, SPEED_CHALLENGE_ENABLED]);

  // Speed challenge countdown: 3, 2, 1 → GO
  useEffect(() => {
    if (speedChallengeCountdown === null) return;
    if (speedChallengeCountdown <= 0) {
      // Start the challenge
      setSpeedChallengeActive(true);
      setSpeedChallengeTime(60);
      setSpeedChallengeCountdown(null);
      // Removed automatic closing of gift panel - let user decide
      return;
    }
    const t = setTimeout(() => setSpeedChallengeCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [speedChallengeCountdown]);

  // Speed challenge timer: 10 → 0
  useEffect(() => {
    if (!speedChallengeActive) return;
    if (speedChallengeTime <= 0) {
      // Challenge ended - determine winner
      setSpeedChallengeActive(false);

      // Read taps from ref (avoids stale closure + avoids dependency on taps object)
      const finalTaps = speedChallengeTapsRef.current;
      const entries = Object.entries(finalTaps).filter(([k]) => {
        if (k === 'me') return true;
        if (k === 'opponent') return battleSlots[0].status === 'accepted';
        if (k === 'player3') return battleSlots[1].status === 'accepted';
        if (k === 'player4') return battleSlots[2].status === 'accepted';
        return false;
      });
      if (entries.length > 0) {
        const maxTaps = Math.max(...entries.map(([, v]) => v));
        const winners = entries.filter(([, v]) => v === maxTaps);
        if (winners.length > 1 || maxTaps === 0) {
          setSpeedChallengeResult('DRAW!');
        } else {
          const winnerKey = winners[0][0];
          const names: Record<string, string> = { me: myCreatorName, opponent: opponentCreatorName || 'P2', player3: battleSlots[1]?.name || 'P3', player4: battleSlots[2]?.name || 'P4' };
          setSpeedChallengeResult(`${names[winnerKey]} wins!`);
        }
        // Auto-clear result after 3s
        setTimeout(() => setSpeedChallengeResult(null), 3000);
      }
      setSpeedMultiplier(1);
      return;
    }
    const t = setTimeout(() => setSpeedChallengeTime(prev => prev - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedChallengeActive, speedChallengeTime]);

  // Simulate opponent taps during speed challenge
  useEffect(() => {
    if (!speedChallengeActive) {
      if (speedChallengeTimerRef.current) clearInterval(speedChallengeTimerRef.current);
      return;
    }
    speedChallengeTimerRef.current = setInterval(() => {
      // Opponent taps randomly 3-8 times per second
      if (battleSlots[0].status === 'accepted') {
        const taps = Math.floor(Math.random() * 6) + 3;
        setSpeedChallengeTaps(prev => ({ ...prev, opponent: (prev.opponent ?? 0) + taps }));
        awardBattlePoints('opponent', taps * 2);
      }
      if (battleSlots[1].status === 'accepted') {
        const taps = Math.floor(Math.random() * 5) + 2;
        setSpeedChallengeTaps(prev => ({ ...prev, player3: (prev.player3 ?? 0) + taps }));
        awardBattlePoints('player3', taps * 2);
      }
      if (battleSlots[2].status === 'accepted') {
        const taps = Math.floor(Math.random() * 5) + 2;
        setSpeedChallengeTaps(prev => ({ ...prev, player4: (prev.player4 ?? 0) + taps }));
        awardBattlePoints('player4', taps * 2);
      }
    }, 1000);
    return () => { if (speedChallengeTimerRef.current) clearInterval(speedChallengeTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedChallengeActive]);

  // Auto-start speed challenge when score thresholds are reached
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED || !isBattleMode || battleWinner) return;
    
    const totalScore = myScore + opponentScore + player3Score + player4Score;
    
    // Check thresholds: 500 -> x2, 1000 -> x3, 2000 -> x5
    let targetMultiplier = 1;
    let threshold = 0;
    if (totalScore >= 2000) { targetMultiplier = 5; threshold = 2000; }
    else if (totalScore >= 1000) { targetMultiplier = 3; threshold = 1000; }
    else if (totalScore >= 500) { targetMultiplier = 2; threshold = 500; }
    
    if (targetMultiplier > 1 && !speedChallengeActive && speedChallengeCountdown === null) {
      // Only trigger if we haven't reached this specific threshold yet
      if (!reachedThresholdsRef.current.has(threshold)) {
        reachedThresholdsRef.current.add(threshold);
        setSpeedMultiplier(targetMultiplier);
        startSpeedChallenge();
      }
    }
  }, [myScore, opponentScore, player3Score, player4Score, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, speedMultiplier, startSpeedChallenge]);

  // Rose trigger effect
  useEffect(() => {
    if (!SPEED_CHALLENGE_ENABLED || !isBattleMode || battleWinner) return;
    if (speedChallengeActive || speedChallengeCountdown !== null) return;

    // Trigger x2 challenge if 30 roses are reached, x3 if 60, x5 if 100
    let targetMultiplier = 1;
    let threshold = 0;
    if (roseCount >= 100) { targetMultiplier = 5; threshold = 10000; } // Using high threshold values to avoid conflict with score thresholds
    else if (roseCount >= 60) { targetMultiplier = 3; threshold = 6000; }
    else if (roseCount >= 30) { targetMultiplier = 2; threshold = 3000; }

    if (targetMultiplier > 1) {
      if (!reachedThresholdsRef.current.has(threshold)) {
        reachedThresholdsRef.current.add(threshold);
        setSpeedMultiplier(targetMultiplier);
        startSpeedChallenge();
      }
    }
  }, [roseCount, isBattleMode, battleWinner, speedChallengeActive, speedChallengeCountdown, startSpeedChallenge]);

  // Auto-cycle multiplier during speed challenge (changes every 2-3s) - DISABLED to follow user's score-based rule
  /*
  useEffect(() => {
    if (!speedChallengeActive) {
      setSpeedMultiplier(1);
      return;
    }
    const multipliers = [2, 3, 5];
    const cycle = () => {
      const next = multipliers[Math.floor(Math.random() * multipliers.length)];
      setSpeedMultiplier(next);
    };
    cycle(); // Start with a random multiplier
    const interval = setInterval(cycle, 2000 + Math.random() * 1000);
    return () => clearInterval(interval);
  }, [speedChallengeActive]);
  */

  useEffect(() => {
    if (!isBattleMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (battleWinner) return;

      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement) {
        const tag = activeEl.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl.isContentEditable) return;
      }

      const key = e.key;
      const code = e.code;

      if (key === 'ArrowLeft' || key === 'a' || key === 'A' || code === 'Numpad4') {
        e.preventDefault();
        handleBattleTap('me');
        spawnHeartAtSide('me');
        addLiveLikes(1);
        return;
      }

      if (key === 'ArrowRight' || key === 'd' || key === 'D' || code === 'Numpad6') {
        e.preventDefault();
        handleBattleTap('opponent');
        spawnHeartAtSide('opponent');
        addLiveLikes(1);
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBattleMode, battleWinner, handleBattleTap, spawnHeartAtSide, addLiveLikes]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldStartBattle = params.get('battle') === '1';
    if (shouldStartBattle && !isBattleMode) {
      toggleBattle();
    }
  }, [location.search, isBattleMode, toggleBattle]);

  useEffect(() => {
    const sampleLeft = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
    const sampleRight = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    const sample3 = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    const sample4 = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';

    if (isBattleMode) {
      if (videoRef.current && !isBroadcast) {
        if (videoRef.current.src !== sampleLeft) videoRef.current.src = sampleLeft;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      if (opponentVideoRef.current) {
        if (opponentVideoRef.current.src !== sampleRight) opponentVideoRef.current.src = sampleRight;
        opponentVideoRef.current.muted = true;
        opponentVideoRef.current.play().catch(() => {});
      }

      if (player3VideoRef.current) {
        if (player3VideoRef.current.src !== sample3) player3VideoRef.current.src = sample3;
        player3VideoRef.current.muted = true;
        player3VideoRef.current.play().catch(() => {});
      }

      if (player4VideoRef.current) {
        if (player4VideoRef.current.src !== sample4) player4VideoRef.current.src = sample4;
        player4VideoRef.current.muted = true;
        player4VideoRef.current.play().catch(() => {});
      }
    }

    if (!isBroadcast) return;

    let cancelled = false;

    let keepStreamAliveOnCleanup = false;

    const stop = () => {
      const current = cameraStreamRef.current;
      if (!current) return;
      current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };

    const start = async () => {
      try {
        setCameraError(null);

        if (cameraFacing !== 'user') {
          clearCachedCameraStream();
        }

        const cached = getCachedCameraStream();
        if (cached) {
          keepStreamAliveOnCleanup = true;
          cameraStreamRef.current = cached;
          cached.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
          if (videoRef.current) {
            videoRef.current.srcObject = cached;
            videoRef.current.play().catch(() => {});
          }
          return;
        }

        stop();

        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraFacing,
            },
            audio: true,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: cameraFacing,
              },
              audio: false,
            });
          } catch {
            setCameraError('Camera access denied');
            return;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        cameraStreamRef.current = stream;
        stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));

        // Set camera zoom to minimum for widest view
        try {
          const vTrack = stream.getVideoTracks()[0];
          const caps = vTrack?.getCapabilities?.() as Record<string, { min?: number; max?: number }>;
          if (caps?.zoom) {
            await vTrack.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet] });
          }
        } catch { /* zoom not supported */ }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraError('Camera access denied');
      }
    };

    start();

    return () => {
      cancelled = true;
      if (!keepStreamAliveOnCleanup) stop();
    };
  }, [isBattleMode, isBroadcast, cameraFacing]);

  useEffect(() => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
  }, [isMicMuted]);

  // ═══════════════════════════════════════════════════════════
  // ULTRA-REALISTIC VIEWER SIMULATION ENGINE (100 viewers)
  // Phases: burst → growth → plateau → natural churn
  // No repetition, natural timing, realistic behavior
  // ═══════════════════════════════════════════════════════════
  const [activeViewers, setActiveViewers] = useState<SimulatedViewer[]>([]);
  useEffect(() => { activeViewersRef.current = activeViewers; }, [activeViewers]);
  useEffect(() => { speedChallengeTapsRef.current = speedChallengeTaps; }, [speedChallengeTaps]);
  const viewerTimersRef = useRef<NodeJS.Timeout[]>([]);
  const chatTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const availablePoolRef = useRef<Omit<SimulatedViewer, 'joinedAt' | 'isActive'>[]>([]);
  const simulationPhaseRef = useRef<'burst' | 'growth' | 'plateau' | 'churn'>('burst');

  useEffect(() => {
    // Shuffle the entire 100-viewer pool
    const shuffled = [...VIEWER_POOL].sort(() => Math.random() - 0.5);
    availablePoolRef.current = [...shuffled];
    const allIntervals: NodeJS.Timeout[] = [];

    // Clear previous timers
    viewerTimersRef.current.forEach(t => clearTimeout(t));
    viewerTimersRef.current = [];

    const addViewer = (viewer: Omit<SimulatedViewer, 'joinedAt' | 'isActive'>, showJoinMsg: boolean, showGreeting: boolean) => {
      const newViewer: SimulatedViewer = { ...viewer, joinedAt: Date.now(), isActive: true };
      setActiveViewers(prev => {
        if (prev.some(v => v.id === viewer.id)) return prev;
        return [...prev, newViewer];
      });

      if (showJoinMsg) {
        // "username joined the live 🇺🇸" system message
        setMessages(prev => [...prev.slice(-30), {
          id: `join_${Date.now()}_${viewer.id}`,
          username: viewer.displayName,
          text: `joined ${viewer.country}`,
          level: viewer.level,
          avatar: viewer.avatar,
          isSystem: true,
        }]);
      }

      // Some viewers say hello when they join (15% chance if showGreeting)
      if (showGreeting && Math.random() < 0.15) {
        const greetDelay = 2000 + Math.random() * 6000; // 2-8s after joining
        const gt = setTimeout(() => {
          const msg = getRandomChatMessage(viewer, true);
          setMessages(prev => [...prev.slice(-30), {
            id: `greet_${Date.now()}_${viewer.id}`,
            username: viewer.displayName,
            text: msg,
            level: viewer.level,
            avatar: viewer.avatar,
          }]);
        }, greetDelay);
        viewerTimersRef.current.push(gt);
      }

      setViewerCount(prev => prev + 1);
    };

    const removeRandomViewer = () => {
      setActiveViewers(prev => {
        if (prev.length <= 8) return prev; // Keep minimum 8 viewers always
        // Prefer removing viewers who've been here longest or have high chatFrequency (less engaged)
        const candidates = prev.filter(v => Date.now() - v.joinedAt > 45000); // Only those here > 45s
        if (candidates.length === 0) return prev;
        // Higher chatFrequency = less engaged = more likely to leave
        const weights = candidates.map(c => c.chatFrequency);
        const totalW = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalW;
        let leaving = candidates[0];
        for (let i = 0; i < candidates.length; i++) {
          r -= weights[i];
          if (r <= 0) { leaving = candidates[i]; break; }
        }
        // Return viewer to available pool so they can rejoin later
        availablePoolRef.current.push({
          id: leaving.id, username: leaving.username, displayName: leaving.displayName,
          level: leaving.level, avatar: leaving.avatar, country: leaving.country, chatFrequency: leaving.chatFrequency,
          supportDays: leaving.supportDays, lastVisitDaysAgo: leaving.lastVisitDaysAgo,
        });
        // Clear their chat timer
        const chatTimer = chatTimersRef.current.get(leaving.id);
        if (chatTimer) { clearTimeout(chatTimer); chatTimersRef.current.delete(leaving.id); }
        setViewerCount(p => Math.max(10, p - 1));
        return prev.filter(v => v.id !== leaving.id);
      });
    };

    const getNextViewer = (): Omit<SimulatedViewer, 'joinedAt' | 'isActive'> | null => {
      if (availablePoolRef.current.length === 0) return null;
      return availablePoolRef.current.shift()!;
    };

    // ─── PHASE 1: BURST (0-25s) ─── 8-15 viewers join quickly
    simulationPhaseRef.current = 'burst';
    const burstCount = 8 + Math.floor(Math.random() * 8); // 8-15
    for (let i = 0; i < burstCount; i++) {
      const viewer = getNextViewer();
      if (!viewer) break;
      const delay = 800 + Math.random() * 22000; // spread over 0.8-22s
      const timer = setTimeout(() => {
        addViewer(viewer, true, true);
      }, delay);
      viewerTimersRef.current.push(timer);
    }

    // ─── PHASE 2: GROWTH (25s-2min) ─── steady stream of new viewers
    const growthStart = setTimeout(() => {
      simulationPhaseRef.current = 'growth';
      let growthAdded = 0;
      const maxGrowth = 25 + Math.floor(Math.random() * 15); // 25-40 more
      const growthInterval = setInterval(() => {
        if (growthAdded >= maxGrowth) { clearInterval(growthInterval); return; }
        const viewer = getNextViewer();
        if (!viewer) { clearInterval(growthInterval); return; }
        addViewer(viewer, Math.random() < 0.6, true);
        growthAdded++;
      }, 2000 + Math.random() * 4000); // every 2-6 seconds
      allIntervals.push(growthInterval);
    }, 25000);
    viewerTimersRef.current.push(growthStart as unknown as NodeJS.Timeout);

    // ─── PHASE 3: PLATEAU (2min+) ─── balance of joining/leaving
    const plateauStart = setTimeout(() => {
      simulationPhaseRef.current = 'plateau';
      
      const joinInterval = setInterval(() => {
        const viewer = getNextViewer();
        if (!viewer) return;
        addViewer(viewer, Math.random() < 0.5, true);
      }, 8000 + Math.random() * 12000);
      allIntervals.push(joinInterval);

      const leaveInterval = setInterval(() => {
        if (Math.random() < 0.6) removeRandomViewer();
      }, 15000 + Math.random() * 25000);
      allIntervals.push(leaveInterval);
    }, 120000);
    viewerTimersRef.current.push(plateauStart as unknown as NodeJS.Timeout);

    // ─── NATURAL CHURN ─── after 4 min, gentle rotate
    const churnStart = setTimeout(() => {
      simulationPhaseRef.current = 'churn';
      const churnInterval = setInterval(() => {
        removeRandomViewer();
        if (Math.random() < 0.4) removeRandomViewer();
        setTimeout(() => {
          const v1 = getNextViewer();
          if (v1) addViewer(v1, Math.random() < 0.4, true);
          if (Math.random() < 0.4) {
            setTimeout(() => {
              const v2 = getNextViewer();
              if (v2) addViewer(v2, Math.random() < 0.3, true);
            }, 3000 + Math.random() * 5000);
          }
        }, 2000 + Math.random() * 5000);
      }, 20000 + Math.random() * 30000);
      allIntervals.push(churnInterval);
    }, 240000);
    viewerTimersRef.current.push(churnStart as unknown as NodeJS.Timeout);

    return () => {
      viewerTimersRef.current.forEach(t => clearTimeout(t));
      allIntervals.forEach(t => clearInterval(t));
      chatTimersRef.current.forEach(t => clearTimeout(t));
      chatTimersRef.current.clear();
    };
  }, []);

  // ─── CHAT SIMULATION ENGINE ───
  // Each viewer chats independently at their own natural pace
  // Includes: normal chat, streamer interaction, viewer-to-viewer replies,
  // gift encouragement, and contextual reactions
  const giftReactionTimersRef = useRef<NodeJS.Timeout[]>([]);
  const simulatedGiftTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only let 1 viewer chat at a time - messages come one by one
    if (chatTimersRef.current.size >= 1) return;
    // Find newly added viewers (not already having a chat timer)
    activeViewers.forEach(viewer => {
      if (chatTimersRef.current.size >= 1) return;
      if (chatTimersRef.current.has(viewer.id)) return;

      const scheduleChat = (v: SimulatedViewer) => {
        const baseDelay = v.chatFrequency * 8000; // 8x slower
        const variance = baseDelay * 0.5;
        const delay = Math.max(40000, baseDelay + (Math.random() * variance * 2 - variance)); // minimum 40 seconds between messages
        
        const timer = setTimeout(() => {
          setActiveViewers(current => {
            const stillActive = current.find(cv => cv.id === v.id);
            if (!stillActive) {
              chatTimersRef.current.delete(v.id);
              return current;
            }
            
            // Decide what kind of message to send based on natural distribution
            const roll = Math.random();
            let context: 'normal' | 'gift_reaction' | 'gift_encourage' | 'streamer' = 'normal';
            if (roll < 0.12) context = 'streamer'; // 12% talk to streamer
            else if (roll < 0.18) context = 'gift_encourage'; // 6% encourage gifting
            // rest is normal (includes viewer-to-viewer, reactions, etc.)
            
            const msg = getRandomChatMessage(v, false, context);
            setMessages(prev => [...prev.slice(-35), {
              id: `chat_${Date.now()}_${v.id}_${Math.random().toString(36).slice(2, 6)}`,
              username: v.displayName,
              text: msg,
              level: v.level,
              avatar: v.avatar,
            }]);
            
            // Release slot so a different viewer can chat next
            chatTimersRef.current.delete(v.id);
            return current;
          });
        }, delay);
        chatTimersRef.current.set(v.id, timer);
      };

      const initialDelay = 3000 + Math.random() * 8000;
      const initTimer = setTimeout(() => scheduleChat(viewer), initialDelay);
      chatTimersRef.current.set(viewer.id, initTimer);
    });

    // Clean up timers for viewers that left
    chatTimersRef.current.forEach((timer, viewerId) => {
      if (!activeViewers.some(v => v.id === viewerId)) {
        clearTimeout(timer);
        chatTimersRef.current.delete(viewerId);
      }
    });
  }, [activeViewers]);

  // ─── GIFT REACTION SYSTEM ───
  // When a gift is sent (real or simulated), 2-5 random active viewers react
  const triggerGiftReactions = useCallback((giftName: string, senderName: string) => {
    if (activeViewers.length < 2) return;
    const reactCount = 1; // only 1 reaction per gift
    const shuffledViewers = [...activeViewers]
      .filter(v => v.displayName !== senderName) // don't react to own gift
      .sort(() => Math.random() - 0.5)
      .slice(0, reactCount);
    
    shuffledViewers.forEach((v, i) => {
      const delay = 800 + (i * (500 + Math.random() * 1500)); // staggered 0.8s-5s
      const timer = setTimeout(() => {
        const msg = getRandomChatMessage(v, false, 'gift_reaction');
        setMessages(prev => [...prev.slice(-35), {
          id: `giftreact_${Date.now()}_${v.id}_${Math.random().toString(36).slice(2, 5)}`,
          username: v.displayName,
          text: msg,
          level: v.level,
          avatar: v.avatar,
        }]);
      }, delay);
      giftReactionTimersRef.current.push(timer);
    });
  }, [activeViewers]);

  // ─── SIMULATED VIEWER GIFTS ───
  // Active viewers occasionally send small gifts (realistic behavior)
  useEffect(() => {
    if (activeViewers.length < 3) return;

    const scheduleSimulatedGift = () => {
      // Random interval between 25-90 seconds
      const delay = 25000 + Math.random() * 65000;
      simulatedGiftTimerRef.current = setTimeout(() => {
        setActiveViewers(current => {
          if (current.length < 3) return current;
          
          // Pick a random active viewer to "send" a gift
          const gifter = current[Math.floor(Math.random() * current.length)];
          
          // Simulated viewers mostly send small/medium gifts
          const smallGiftNames = [
            { name: 'Red Rose', icon: '🌹', coins: 1 },
            { name: 'Love Heart', icon: '❤️', coins: 5 },
            { name: 'Morning Coffee', icon: '☕', coins: 15 },
            { name: 'Ice Cream', icon: '🍦', coins: 50 },
            { name: 'Super Car', icon: '🏎️', coins: 500 },
            { name: 'Diamond Ring', icon: '💍', coins: 1000 },
            { name: 'Teddy Bear', icon: '🧸', coins: 100 },
            { name: 'Star', icon: '⭐', coins: 25 },
            { name: 'Crown', icon: '👑', coins: 200 },
            { name: 'Rocket', icon: '🚀', coins: 300 },
          ];
          
          // Higher level viewers send more expensive gifts
          let giftPool = smallGiftNames;
          if (gifter.level < 20) {
            giftPool = smallGiftNames.filter(g => g.coins <= 50);
          } else if (gifter.level < 40) {
            giftPool = smallGiftNames.filter(g => g.coins <= 200);
          }
          // Level 40+ can send any
          
          const gift = giftPool[Math.floor(Math.random() * giftPool.length)];
          
          // Gift message in chat
          setMessages(prev => [...prev.slice(-35), {
            id: `simgift_${Date.now()}_${gifter.id}`,
            username: gifter.displayName,
            text: `Sent a ${gift.name} ${gift.icon}`,
            isGift: true,
            level: gifter.level,
            avatar: gifter.avatar,
          }]);

          // Trigger reactions from other viewers
          setTimeout(() => {
            triggerGiftReactions(gift.name, gifter.displayName);
          }, 500);
          
          return current;
        });
        
        // Schedule next simulated gift
        scheduleSimulatedGift();
      }, delay);
    };

    // Start after initial delay
    const initDelay = setTimeout(() => scheduleSimulatedGift(), 30000 + Math.random() * 20000);

    return () => {
      clearTimeout(initDelay);
      if (simulatedGiftTimerRef.current) clearTimeout(simulatedGiftTimerRef.current);
      giftReactionTimersRef.current.forEach(t => clearTimeout(t));
      giftReactionTimersRef.current = [];
    };
  }, [activeViewers.length > 2, triggerGiftReactions]);

  // Organic viewer count fluctuation (slight random ±1-3)
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(10, prev + delta);
      });
    }, 6000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  const [giftQueue, setGiftQueue] = useState<string[]>([]);
  const [isPlayingGift, setIsPlayingGift] = useState(false);
  const [lastSentGift, setLastSentGift] = useState<typeof GIFTS[0] | null>(null);
  const [userLevel, setUserLevel] = useState(1);


  const [userXP, setUserXP] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [showComboButton, setShowComboButton] = useState(false);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [activeFaceARGift, setActiveFaceARGift] = useState<
    | { type: 'crown' | 'glasses' | 'mask' | 'ears' | 'hearts' | 'stars'; color?: string }
    | null
  >(null);

  const maybeTriggerFaceARGift = (gift: typeof GIFTS[0]) => {
    const mapping: Record<string, { type: 'crown' | 'glasses' | 'mask' | 'ears' | 'hearts' | 'stars'; color?: string } | undefined> = {
      face_ar_crown: { type: 'crown', color: '#FFD700' },
      face_ar_glasses: { type: 'glasses', color: '#00D4FF' },
      face_ar_hearts: { type: 'hearts', color: '#FF3B7A' },
      face_ar_mask: { type: 'mask', color: '#7C3AED' },
      face_ar_ears: { type: 'ears', color: '#22C55E' },
      face_ar_stars: { type: 'stars', color: '#F59E0B' },
    };

    const next = mapping[gift.id];
    if (!next) return;
    setActiveFaceARGift(next);
  };

  // Queue Processing
  useEffect(() => {
    if (!isPlayingGift && giftQueue.length > 0) {
        const nextGift = giftQueue[0];
        setCurrentGift(nextGift);
        setIsPlayingGift(true);
        setGiftQueue(prev => prev.slice(1));
    }
  }, [giftQueue, isPlayingGift]);

  // Handle gift animation end
  const handleGiftEnded = () => {
      setCurrentGift(null);
      setIsPlayingGift(false);
  };

  const handleSendGift = async (gift: typeof GIFTS[0]) => {
    if (!gift) return;

    try {
      // Allow everyone to spend if they have coins locally (which we just set to max)
      if (coinBalance < gift.coins) {
          setShowGiftPanel(false);
          setShowCoinModal(true);
          return;
      }
      
      let newLevel = userLevel;
      
      if (user?.id) {
        try {
          const { data, error } = await supabase.rpc('send_stream_gift', {
            p_stream_key: effectiveStreamId,
            p_gift_id: gift.id,
          });

          if (error) {
            const msg = typeof error.message === 'string' ? error.message : '';
            if (msg.includes('insufficient_funds')) {
              setShowGiftPanel(false);
              setShowCoinModal(true);
              return;
            }
            setCoinBalance(prev => Math.max(0, prev - gift.coins));
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.new_balance != null) {
              setCoinBalance(Number(row.new_balance));
            }
            if (row?.new_level != null) {
              const updatedLevel = Number(row.new_level);
              setUserLevel(updatedLevel);
              updateUser({ level: updatedLevel });
              newLevel = updatedLevel;
            }
            if (row?.new_xp != null) {
              setUserXP(Number(row.new_xp));
            }
          }
        } catch {
          // Fallback: deduct locally
          setCoinBalance(prev => Math.max(0, prev - gift.coins));
        }

        // Update level/XP locally
        const xpGained = gift.coins;
        let currentXP = userXP + xpGained;
        let currentLevel = userLevel;
        while (true) {
          const xpNeeded = currentLevel * 1000;
          if (currentXP >= xpNeeded && currentLevel < 150) {
            currentLevel++;
            currentXP -= xpNeeded;
          } else {
            break;
          }
        }
        setUserLevel(currentLevel);
        setUserXP(currentXP);
        updateUser({ level: currentLevel });
        newLevel = currentLevel;

        // Sync level/xp to DB
        supabase.from('profiles')
          .update({ level: currentLevel, xp: currentXP })
          .eq('user_id', user.id)
          .then(() => {});
      } else {
        setCoinBalance(prev => Math.max(0, prev - gift.coins));
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + gift.coins);

      maybeEnqueueUniverse(gift.name, viewerName);
      addBattleGifterCoins(viewerName, gift.coins);

      // Rose trigger for Speed Challenge
      if (gift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      if (isBattleMode && battleTime > 0 && !battleWinner) {
        awardBattlePoints(giftTarget, gift.coins);
      }
      
      setShowGiftPanel(false);

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(gift);
      }
      
      // Always queue the video animation for the sender/viewer to see immediate feedback
      if (gift.video) {
        setGiftQueue(prev => [...prev, gift.video]);
      }
      
      // Add to chat
      const giftMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: `Sent a ${gift.name}`,
          isGift: true,
          level: newLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);

      // Viewers react to the gift being sent
      setTimeout(() => triggerGiftReactions(gift.name, viewerName), 1000 + Math.random() * 2000);

      // Handle Combo Logic
      setLastSentGift(gift);
      setComboCount(1);
      setShowComboButton(true);
      resetComboTimer();
    } catch (error) {
      console.error('Error sending gift:', error);
    }
  };

  const handleShare = async () => {
    setShowSharePanel(true);
  };

  const toggleMic = () => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    const stream = cameraStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const flipCamera = async () => {
    if (!isBroadcast) return;
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const resetComboTimer = () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
          setShowComboButton(false);
          setComboCount(0);
          setLastSentGift(null);
      }, 5000); // 5 seconds to combo
  };

  const handleComboClick = async () => {
      if (!lastSentGift) return;
      
      // Check balance
      if (coinBalance < lastSentGift.coins) {
        alert("Not enough coins!");
        return;
      }

      let newLevel = userLevel;
      if (user?.id) {
        try {
          const { data, error } = await supabase.rpc('send_stream_gift', {
            p_stream_key: effectiveStreamId,
            p_gift_id: lastSentGift.id,
          });

          if (error) {
            const msg = typeof error.message === 'string' ? error.message : '';
            if (msg.includes('insufficient_funds')) {
              alert('Not enough coins');
              return;
            }
            setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.new_balance != null) setCoinBalance(Number(row.new_balance));
            if (row?.new_level != null) {
              newLevel = Number(row.new_level);
              setUserLevel(newLevel);
              updateUser({ level: newLevel });
            }
            if (row?.new_xp != null) setUserXP(Number(row.new_xp));
          }
        } catch {
          setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
        }
      } else {
        setCoinBalance(prev => Math.max(0, prev - lastSentGift.coins));
      }

      // Track session contribution for membership
      setSessionContribution(prev => prev + lastSentGift.coins);

      maybeEnqueueUniverse(lastSentGift.name, viewerName);
      addBattleGifterCoins(viewerName, lastSentGift.coins);

      // Rose trigger for Speed Challenge
      if (lastSentGift.name.toLowerCase().includes('rose')) {
        roseCountRef.current += 1;
        setRoseCount(roseCountRef.current);
      }

      if (isBattleMode && battleTime > 0 && !battleWinner) {
        awardBattlePoints(giftTarget, lastSentGift.coins);
      }
      
      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(lastSentGift);
      }
      
      // Always queue the video animation for the sender/viewer to see immediate feedback
      if (lastSentGift.video) {
        setGiftQueue(prev => [...prev, lastSentGift.video]);
      }
      
      // Add to chat
      const giftMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: `Sent a ${lastSentGift.name}`,
          isGift: true,
          level: newLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);

      // Viewers react to the gift being sent
      setTimeout(() => triggerGiftReactions(lastSentGift.name, viewerName), 1000 + Math.random() * 2000);

      // Handle Combo Logic
      setComboCount(prev => prev + 1);
      resetComboTimer();
  };

  const _simulateIncomingGift = () => {
      const randomGift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
      
      // Use a real active viewer as the gifter (much more realistic)
      let gifterName: string;
      let gifterAvatar: string;
      let gifterLevel: number | undefined;
      if (activeViewers.length > 0) {
        const gifter = activeViewers[Math.floor(Math.random() * activeViewers.length)];
        gifterName = gifter.displayName;
        gifterAvatar = gifter.avatar;
        gifterLevel = gifter.level;
      } else {
        // Fallback for early stream before viewers join
        const fallbackNames = ['Luna V.', 'Alex M.', 'Sofia B.'];
        gifterName = fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
        gifterAvatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(gifterName)}`;
      }
      
      const isFaceARGift = randomGift.id.startsWith('face_ar_');
      if (!isFaceARGift && randomGift.video) {
        setGiftQueue(prev => [...prev, randomGift.video]);
      }

      if (isBroadcast && !isBattleMode) {
        maybeTriggerFaceARGift(randomGift);
      }

      maybeEnqueueUniverse(randomGift.name, gifterName);
      addBattleGifterCoins(gifterName, randomGift.coins);

      if (isBattleMode && battleTime > 0 && !battleWinner) {
        const target = Math.random() > 0.5 ? 'me' : 'opponent';
        awardBattlePoints(target, randomGift.coins);
      }
      
      const giftMsg = {
          id: Date.now().toString(),
          username: gifterName,
          text: `Sent a ${randomGift.name} ${randomGift.icon}`,
          isGift: true,
          level: gifterLevel,
          avatar: gifterAvatar,
      };
      setMessages(prev => [...prev, giftMsg]);

      // Other viewers react to the gift
      setTimeout(() => triggerGiftReactions(randomGift.name, gifterName), 800 + Math.random() * 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;
      
      const newMsg = {
          id: Date.now().toString(),
          username: viewerName,
          text: inputValue,
          level: userLevel,
          avatar: viewerAvatar,
      };
      setMessages(prev => [...prev, newMsg]);
      setInputValue('');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stopBroadcast = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      clearCachedCameraStream();
      navigate('/');
  };

  const handleScreenTap = (e?: React.MouseEvent | React.TouchEvent) => {
    // 1. Spawn visual heart at tap location
    if (e) {
      let clientX, clientY;
      // Handle both mouse and touch events
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      if (clientX !== undefined && clientY !== undefined) {
        spawnHeartFromClient(clientX, clientY, undefined, myCreatorName, myAvatar);
      }
    } else {
      // Fallback for keyboard or other triggers
      spawnHeartAtSide('me');
    }

    // 2. Battle Logic: handled by handleBattleTap on individual player buttons
  };

  const handleLikeTap = (e?: React.MouseEvent | React.TouchEvent) => {
    // Only spawn heart and add like if NOT in battle mode (or explicit chat tap)
    if (e) {
      let clientX, clientY;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      if (clientX !== undefined && clientY !== undefined) {
        spawnHeartFromClient(clientX, clientY, undefined, myCreatorName, myAvatar);
      }
    }
    addLiveLikes(1);
  };

  const openMiniProfile = (username: string, coins?: number) => {
    const viewer = VIEWER_POOL.find(v => v.displayName === username || v.username === username);
    const avatar = username === myCreatorName
      ? myAvatar
      : viewer?.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(username)}`;
    const level = username === myCreatorName ? userLevel : (viewer?.level ?? null);
    // Each user's total donated coins: supportDays * coins per day based on level
    const donated = viewer ? viewer.supportDays * (50 + Math.floor((viewer.level || 1) * 15)) : (username === myCreatorName ? sessionContribution : 0);
    setMiniProfile({ username, avatar, level, coins, donated });
  };

  const closeMiniProfile = () => setMiniProfile(null);

  const _startBattleMatch = () => {
    if (!isBattleMode) return;
    setMyScore(0);
    setOpponentScore(0);
    setBattleWinner(null);
    setBattleGifterCoins({});
    battleFreeTapUsedRef.current = false;
    battleScoreTapWindowRef.current = { windowStart: 0, count: 0 };
    setBattleTime(0);
    setBattleCountdown(3);
  };

  const _closeBattleMatch = () => {
    if (!isBattleMode) return;
    setBattleCountdown(null);
    setBattleTime(0);
    const winner = determine4PlayerWinner();
    setBattleWinner(winner);
  };

  // 2v2 Team Scores: Red Team (P1 + P3) vs Blue Team (P2 + P4)
  const redTeamScore = myScore + player3Score;
  const blueTeamScore = opponentScore + player4Score;
  const totalScore = redTeamScore + blueTeamScore;
  const leftPctRaw = totalScore > 0 ? (redTeamScore / totalScore) * 100 : 50;
  const leftPct = Math.max(3, Math.min(97, leftPctRaw));
  const universeText = currentUniverse
    ? `${currentUniverse.sender} sent ${universeGiftLabel} to ${currentUniverse.receiver}`
    : '';
  const _universeDurationSeconds = Math.max(6, Math.min(16, universeText.length * 0.12));
  const _isLiveNormal = isBroadcast && !isBattleMode;
  const activeLikes = liveLikes;

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="relative w-full h-screen bg-black overflow-hidden border-none">
        <div className="h-full w-full relative">
        {/* BACKGROUND: VIDEO AREA (Unified frame) */}
        <div className="absolute inset-0 z-0 bg-black overflow-hidden">
          <div className="video-zone relative w-full h-full">
            <div ref={stageRef} className="relative w-full h-full">
            {/* FLOATING HEARTS */}
            {floatingHearts.map((h) => (
              <div
                key={h.id}
                className="absolute elix-heart-float z-[200] flex items-center gap-1.5"
                style={{
                  left: h.x,
                  top: h.y,
                  '--elix-heart-dx': '0px',
                  '--elix-heart-rot': '0deg',
                } as React.CSSProperties}
              >
                <svg width={h.size} height={h.size} viewBox="0 0 24 24" fill={h.color} stroke="none" className="flex-shrink-0">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                {h.username && (
                  <span className="text-[#C8CCD4] text-[11px] font-bold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    {h.username}
                  </span>
                )}
              </div>
            ))}
            
            {/* Base Video Layer */}
        {!isBattleMode && (
          <div
            className="relative w-full h-full"
            onPointerDown={(e) => {
              if (isBattleMode && isBroadcast) return;
              if (e.target instanceof Element) {
                const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                if (interactive) return;
              }
              // Normal Like Tap
              handleLikeTap(e);
              
              const now = Date.now();
              const last = lastScreenTapRef.current;
              lastScreenTapRef.current = now;
              if (now - last <= 320) {
                handleComboClick();
              }
            }}
          >
            {isBroadcast ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <video
                src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => {
                  console.warn("Video failed to load, falling back to black");
                  e.currentTarget.style.display = 'block';
                  e.currentTarget.parentElement?.classList.add('bg-black');
                }}
              />
            )}

            {isBroadcast && activeFaceARGift && (
              <>
                <canvas
                  ref={faceARCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                <FaceARGift
                  giftType={activeFaceARGift.type}
                  color={activeFaceARGift.color || '#E6B36A'}
                />
              </>
            )}

            {isBroadcast && cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black text-white font-bold">
                {cameraError}
              </div>
            )}
          </div>
        )}

        {/* Battle Split Screen Overlay - Shows ONLY when in battle mode */}
        {isBattleMode && (
          <div
            className={`absolute inset-0 z-[80] flex flex-col ${isBroadcast ? 'pointer-events-none' : ''}`}
            style={{ paddingTop: isBroadcast ? '90px' : '90px', paddingBottom: isBroadcast ? '305px' : undefined }}
            onClick={(e) => {
              if (isBroadcast) return;
              e.stopPropagation(); // STOP PROPAGATION to prevent double counting
              handleScreenTap(e);
            }}
          >
            {battleCountdown != null && (
              <div className="absolute inset-0 z-[260] pointer-events-none flex items-center justify-center">
                {/* LUXURY BATTLE COUNTDOWN */}
                <div className="w-32 h-32 flex items-center justify-center animate-luxury-pulse relative">
                  <div className="text-white text-6xl font-black tabular-nums relative z-10 drop-shadow-[0_0_20px_rgba(230,179,106,1)]">{battleCountdown}</div>
                </div>
              </div>
            )}





      {/* ═══ SPEED CHALLENGE OVERLAY ═══ */}
      {SPEED_CHALLENGE_ENABLED && speedChallengeCountdown !== null && (
              <div className="absolute inset-x-0 bottom-32 z-[270] pointer-events-none flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-[#E6B36A]/30 shadow-[0_0_30px_rgba(230,179,106,0.2)]">
                  <span className="text-[#E6B36A] text-[12px] font-bold uppercase tracking-widest">
                    Speed Challenge {speedMultiplier > 1 ? `x${speedMultiplier}` : ''}
                  </span>
                  <div className="text-white text-7xl font-black tabular-nums drop-shadow-[0_0_30px_rgba(230,179,106,1)] animate-pulse">
                    {speedChallengeCountdown}
                  </div>
                  <span className="text-white/60 text-[10px] font-semibold">Get ready to tap!</span>
                </div>
              </div>
            )}



            {SPEED_CHALLENGE_ENABLED && speedChallengeResult && !speedChallengeActive && (
              <div className="absolute inset-x-0 bottom-24 z-[270] pointer-events-none flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl bg-black/70 backdrop-blur-md border border-[#E6B36A]/30 shadow-[0_0_20px_rgba(230,179,106,0.3)]">
                  <span className="text-[#E6B36A] text-[10px] font-bold uppercase tracking-widest">⚡ Speed Challenge Result</span>
                  <span className="text-white text-lg font-black drop-shadow-[0_0_15px_rgba(230,179,106,0.8)] animate-bounce">{speedChallengeResult}</span>
                </div>
              </div>
            )}

            {/* Dynamic Battle Grid: 2-split or 4-split based on players */}
            {(() => {
              const is4Player = battleSlots[1].status !== 'empty' || battleSlots[2].status !== 'empty';
              return (
                <div className={`relative w-full flex-none flex flex-col ${is4Player ? 'aspect-square' : 'h-[42vh]'}`}>
                  {/* Fan Club Button - Left of Battle Bar */}
                  <div className="absolute top-2 left-[20%] -translate-x-1/2 z-30 pointer-events-auto">
                    {/* Fan Club Removed */}
                  </div>

                  {/* Score Bar on top - Red vs Blue */}
                  <button
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (isBroadcast) {
                        toggleBattle(); 
                      } else {
                        // For spectators: Tap on bar -> Like
                       spawnHeartFromClient(e.clientX, e.clientY);
                       // Do not add live likes on battle bar tap
                       
                      }
                    }}
                    className="relative z-20 w-full h-4 overflow-hidden shadow-2xl pointer-events-auto flex-none cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="absolute inset-0 flex">
                      <div className="h-full transition-all duration-500 ease-out" style={{ width: `${leftPct}%`, backgroundImage: 'linear-gradient(90deg, #DC143C, #FF1744, #C41E3A)' }} />
                      <div className="h-full flex-1 transition-all duration-500 ease-out" style={{ backgroundImage: 'linear-gradient(90deg, #1E90FF, #4169E1, #0047AB)' }} />
                    </div>
                    <div className="relative z-10 h-full flex items-center justify-between px-2">
                      <div className="text-white font-black text-[8px] tabular-nums">{redTeamScore.toLocaleString()}</div>
                      
                      {/* Battle Timer with VS */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="text-[#E6B36A] text-[10px] font-black italic">VS</span>
                        <div className="px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm border border-[#E6B36A]/30">
                          <span className="text-[#E6B36A] text-[9px] font-black tabular-nums leading-none">
                            {formatTime(battleTime)}
                          </span>
                        </div>
                      </div>

                      <div className="text-white font-black text-[8px] tabular-nums">{blueTeamScore.toLocaleString()}</div>
                    </div>
                  </button>


                  {/* Top Row (or only row for 2-player): P1 & P2 */}
                  <div className="flex flex-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGiftTarget('me'); }}
                      onPointerDown={(e) => { e.stopPropagation(); handleBattleTap('me'); spawnHeartFromClient(e.clientX, e.clientY); }}
                      className={`w-1/2 h-full overflow-hidden relative bg-black pointer-events-auto border-r border-white/5 ${is4Player ? 'border-b' : ''}`}
                    >
                      <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />
                      <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                        <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('me'); }}>
                          {mutedPlayers['me'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); toggleBattle(); }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                        </div>
                      </div>


                      {battleWinner && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'me' ? 'text-green-400' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                            {battleWinner === 'me' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setGiftTarget('opponent'); }}
                      onPointerDown={(e) => { e.stopPropagation(); handleBattleTap('opponent'); spawnHeartFromClient(e.clientX, e.clientY); addLiveLikes(1); }}
                      className={`w-1/2 h-full overflow-hidden relative bg-gray-900 pointer-events-auto ${is4Player ? 'border-b border-white/5' : ''}`}
                    >
                      {battleSlots[0].status === 'accepted' ? (
                        <video ref={opponentVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                      ) : battleSlots[0].status === 'invited' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900">
                          <img src={battleSlots[0].avatar} alt={battleSlots[0].name} className="w-12 h-12 rounded-full border-2 border-[#E6B36A] opacity-60" />
                          <div className="w-5 h-5 border-2 border-[#00f2ea] border-t-transparent rounded-full animate-spin" />
                          <span className="text-[#00f2ea] text-[10px] font-bold">Waiting...</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                            <span className="text-white/30 text-2xl">+</span>
                          </div>
                          <span className="text-white/40 text-[10px] font-bold">Invite P2</span>
                        </div>
                      )}

                      {battleSlots[0].status !== 'empty' && (
                        <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                          <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('opponent'); }}>
                            {mutedPlayers['opponent'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(0); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                          </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 right-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[0].name); }}
                      >
                        {lastGifts.opponent && (
                          <div className="w-5 h-5 rounded-full bg-black/40 border border-white/20 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.opponent} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 bg-black/40 backdrop-blur-md border border-white/10 ${lastGifts.opponent ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                        >
                          {battleSlots[0].status !== 'empty' ? battleSlots[0].name : 'P2'}
                        </div>
                      </div>

                      {battleWinner && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'opponent' ? 'text-green-400' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                            {battleWinner === 'opponent' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Bottom Row: Player 3 & Player 4 - ONLY shown when 4 players */}
                  {is4Player && (
                    <div className="flex flex-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setGiftTarget('player3'); }}
                        onPointerDown={(e) => { e.stopPropagation(); handleBattleTap('player3'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className="w-1/2 h-full overflow-hidden relative bg-gray-900 pointer-events-auto border-r border-white/5"
                      >
                        {battleSlots[1].status === 'accepted' ? (
                          <video ref={player3VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : battleSlots[1].status === 'invited' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900">
                            <img src={battleSlots[1].avatar} alt={battleSlots[1].name} className="w-12 h-12 rounded-full border-2 border-[#E6B36A] opacity-60" />
                            <div className="w-5 h-5 border-2 border-[#00f2ea] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[#00f2ea] text-[10px] font-bold">Waiting...</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                              <span className="text-white/30 text-2xl">+</span>
                            </div>
                            <span className="text-white/40 text-[10px] font-bold">Invite P3</span>
                          </div>
                        )}

                        {battleSlots[1].status !== 'empty' && (
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player3'); }}>
                              {mutedPlayers['player3'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(1); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 left-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[1].name); }}
                      >
                        {lastGifts.player3 && (
                          <div className="w-5 h-5 rounded-full bg-black/40 border border-white/20 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.player3} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 ${lastGifts.player3 ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                          style={{ background: 'linear-gradient(135deg, rgba(0,200,83,0.7), rgba(0,200,83,0.3))' }}
                        >
                          {battleSlots[1].status !== 'empty' ? battleSlots[1].name : 'P3'}
                        </div>
                      </div>

                      {battleWinner && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'me' ? 'text-green-400' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                              {battleWinner === 'me' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                            </span>
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setGiftTarget('player4'); }}
                        onPointerDown={(e) => { e.stopPropagation(); handleBattleTap('player4'); spawnHeartFromClient(e.clientX, e.clientY); }}
                        className="w-1/2 h-full overflow-hidden relative bg-gray-900 pointer-events-auto"
                      >
                        {battleSlots[2].status === 'accepted' ? (
                          <video ref={player4VideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        ) : battleSlots[2].status === 'invited' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900">
                            <img src={battleSlots[2].avatar} alt={battleSlots[2].name} className="w-12 h-12 rounded-full border-2 border-[#E6B36A] opacity-60" />
                            <div className="w-5 h-5 border-2 border-[#00f2ea] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[#00f2ea] text-[10px] font-bold">Waiting...</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900/80 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsFindCreatorsOpen(true); }}>
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                              <span className="text-white/30 text-2xl">+</span>
                            </div>
                            <span className="text-white/40 text-[10px] font-bold">Invite P4</span>
                          </div>
                        )}

                        {battleSlots[2].status !== 'empty' && (
                          <div className="absolute top-1 right-1 z-10 pointer-events-auto flex items-center gap-1">
                            <div onClick={(e) => { e.stopPropagation(); togglePlayerMute('player4'); }}>
                              {mutedPlayers['player4'] ? <VolumeX className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={2.5} />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); removePlayerFromSlot(2); }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                            </div>
                        </div>
                      )}

                      <div 
                        className="absolute bottom-1 right-1 flex items-center cursor-pointer hover:scale-105 transition-transform active:scale-95 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); openMiniProfile(battleSlots[2].name); }}
                      >
                        {lastGifts.player4 && (
                          <div className="w-5 h-5 rounded-full bg-black/40 border border-white/20 overflow-hidden flex items-center justify-center drop-shadow-md z-10 relative">
                            <img src={lastGifts.player4} alt="gift" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div 
                          className={`h-4 flex items-center rounded-full text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-0 ${lastGifts.player4 ? '-ml-2 pl-3 pr-1.5' : 'px-1.5'}`}
                          style={{ background: 'linear-gradient(135deg, rgba(156,39,176,0.7), rgba(156,39,176,0.3))' }}
                        >
                          {battleSlots[2].status !== 'empty' ? battleSlots[2].name : 'P4'}
                        </div>
                      </div>

                      {battleWinner && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className={`text-sm font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${battleWinner === 'opponent' ? 'text-green-400' : battleWinner === 'draw' ? 'text-white' : 'text-red-400'}`}>
                              {battleWinner === 'opponent' ? 'WIN' : battleWinner === 'draw' ? 'DRAW' : 'LOSS'}
                            </span>
                          </div>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

              {/* MVP Circles - outside below battle frame, 3 left + 3 right */}
            <div className="w-full px-3 py-2 flex items-center justify-between flex-none pointer-events-none mt-1 relative z-30">
              {/* Left side - top gifters for P1 */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[['#FFD700'], ['#C0C0C0'], ['#CD7F32']].map(([c], i) => {
                  const g = getTopGifters('me')[i];
                  return g ? (
                    <div key={i} className="w-9 h-9 rounded-full overflow-hidden border-[2.5px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ borderColor: c, zIndex: 3 - i }}><img src={g.avatar} alt={g.name} className="w-full h-full object-cover" /></div>
                  ) : (
                    <div key={i} className="w-9 h-9 rounded-full overflow-hidden border-[2.5px] bg-black/80" style={{ borderColor: c, zIndex: 3 - i }}><img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="" className="w-full h-full object-cover opacity-50" /></div>
                  );
                })}
              </div>

              {/* Speed Challenge Timer - MOVED HERE between circles */}
              {SPEED_CHALLENGE_ENABLED && speedChallengeActive && (
                <div className="flex items-center gap-3 px-5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#00f2ea]/30 shadow-[0_0_15px_rgba(0,242,234,0.3)] animate-luxury-fade-in">
                  <span className="text-[#00f2ea] text-[9px] font-bold uppercase tracking-[0.1em]">⚡ Speed</span>
                  <span className="text-white text-[14px] font-black tabular-nums">{speedChallengeTime}s</span>
                  {speedMultiplier > 1 && (
                    <span className="text-[#00f2ea] text-[11px] font-black animate-pulse">x{speedMultiplier}</span>
                  )}
                </div>
              )}

              {/* Right side - top gifters for P2 */}
              <div className="flex items-center -space-x-1.5 pointer-events-auto" onClick={() => setShowViewerList(true)}>
                {[['#FFD700'], ['#C0C0C0'], ['#CD7F32']].map(([c], i) => {
                  const g = getTopGifters('opponent')[i];
                  return g ? (
                    <div key={i} className="w-9 h-9 rounded-full overflow-hidden border-[2.5px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ borderColor: c, zIndex: 3 - i }}><img src={g.avatar} alt={g.name} className="w-full h-full object-cover" /></div>
                  ) : (
                    <div key={i} className="w-9 h-9 rounded-full overflow-hidden border-[2.5px] bg-black/80" style={{ borderColor: c, zIndex: 3 - i }}><img src={`https://i.pravatar.cc/100?img=${i + 15}`} alt="" className="w-full h-full object-cover opacity-50" /></div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>

        <div className="relative z-10 h-full pointer-events-none">
          {/* Input Layer Removed - Moved to Bottom Zone */}

          <div className="relative flex flex-col h-full pointer-events-none">
            {/* TOP AREA: Overlays (Top Bar & Floating Buttons) */}
            <div className="flex-[0_0_50vh] relative pointer-events-none">
              {/* Top Bar */}
              {isBroadcast ? (
                <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
                  <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="pointer-events-auto flex flex-col gap-2">
                        {/* BROADCASTER INFO */}
                        <div className="px-0 py-1 animate-luxury-fade-in -ml-2 relative">
                          <div className="flex items-center relative">
                            <div 
                              className="relative z-10 w-14 h-14 rounded-full border-2 border-white overflow-hidden flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                              onClick={(e) => { e.stopPropagation(); openMiniProfile(myCreatorName); }}
                            >
                              <img src={myAvatar} alt={myCreatorName} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col justify-center -ml-4 pl-6 pr-16 h-9 rounded-full border border-white/60 bg-black/50 min-w-[140px] relative" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
                              <span className="text-white text-[10px] font-bold truncate max-w-[160px] leading-tight">{myCreatorName}</span>
                              <button
                  type="button"
                  className="flex items-center gap-0.5 pointer-events-auto -mt-0.5"
                  onPointerDown={(e) => {
                    handleLikeTap(e);
                  }}
                >
                                <Heart className="w-2 h-2 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                                <span className="text-white/70 text-[8px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                              </button>
                              
                              {(() => {
                                const activeIds = new Set(activeViewers.map(v => v.id));
                                const redCount = VIEWER_POOL.filter(v => activeIds.has(v.id) || (v.lastVisitDaysAgo ?? 0) < 2).length;
                                const greyCount = VIEWER_POOL.filter(v => !activeIds.has(v.id) && (v.lastVisitDaysAgo ?? 0) >= 2).length;
                                return (
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center pointer-events-auto">
                                    {/* Membership / Join Button (Bottom) */}
                                    <button
                                      type="button"
                                      className={`col-start-1 row-start-1 flex items-center justify-center gap-1 ${hasJoinedToday ? 'bg-[#FF6B00] border-[#FF6B00]' : 'bg-white border-white/20'} rounded-full px-1.5 py-0.5 shadow-sm border w-[58px] h-7 z-0 transition-colors duration-200`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!hasJoinedToday && user?.id && effectiveStreamId) {
                                          const today = new Date().toISOString().split('T')[0];
                                          const storageKey = `joined_stream_${effectiveStreamId}_${user.id}_${today}`;
                                          localStorage.setItem(storageKey, 'true');
                                          
                                          // Update total heart count
                                          const heartKey = `my_heart_count_${effectiveStreamId}_${user.id}`;
                                          const newCount = myHeartCount + 1;
                                          localStorage.setItem(heartKey, newCount.toString());
                                          setMyHeartCount(newCount);
                                          
                                          setMemberCount(prev => prev + 1);
                                          setHasJoinedToday(true);
                                          setShowTeamStatus(true);
                                          
                                          // Send animated heart to chat
                                          const newMessage: LiveMessage = {
                                            id: Date.now().toString(),
                                            username: 'You',
                                            text: '❤️ Joined the team!',
                                            level: userLevel,
                                            isGift: false,
                                            avatar: 'https://i.pravatar.cc/150?img=68',
                                            isSystem: true,
                                            membershipIcon: '/icons/Membership.png'
                                          };
                                          setMessages(prev => [...prev, newMessage]);
                                          spawnHeartFromClient(e.clientX, e.clientY);

                                        } else if (hasJoinedToday) {
                                          setShowTeamStatus(true);
                                        }
                                      }}
                                    >
                                      <div className="relative">
                                        <Heart
                                          className={`w-3.5 h-3.5 ${hasJoinedToday ? 'text-white fill-white' : 'text-[#FF6B00] fill-[#FF6B00]'}`}
                                          strokeWidth={2.5}
                                        />
                                        {!hasJoinedToday && (
                                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF6B00] rounded-full flex items-center justify-center border border-white">
                                            <span className="text-white text-[6px] font-bold leading-none">+</span>
                                          </div>
                                        )}
                                      </div>
                                      <span className={`${hasJoinedToday ? 'text-white' : 'text-[#FF6B00]'} text-[10px] font-bold`}>Join</span>
                                    </button>

                                    {/* Follow Button (Top) - Shows "+ Follow" */}
                                    {!isFollowing && (
                                      <button
                                        type="button"
                                        className="col-start-1 row-start-1 z-20 relative flex items-center justify-center gap-1 bg-[#FF2D55] rounded-full px-1.5 py-0.5 shadow-sm border border-white/20 w-[58px] h-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsFollowing(true);
                                        }}
                                      >
                                        <Plus size={12} className="text-white" strokeWidth={3} />
                                        <span className="text-white text-[10px] font-bold">Follow</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1 ml-9 pointer-events-auto relative z-20">
                            <div 
                              className="flex items-center gap-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full px-2 py-0.5 border border-white/10 shadow-sm cursor-pointer w-fit" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRankingPanel(true);
                              }}
                            >
                              <Trophy className="w-2.5 h-2.5 text-white" />
                              <span className="text-white text-[9px] font-bold whitespace-nowrap">Weekly Ranking &gt;</span>
                            </div>
                            <div 
                              className="flex items-center gap-1 bg-[#FF2D55] rounded-full px-2 py-0.5 border border-white/10 shadow-sm cursor-pointer w-fit ml-4" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFanClub(true);
                              }}
                            >
                              <img src="/icons/Membership.png" alt="Membership" className="w-3.5 h-3.5 object-contain" onError={(e) => {
                                // Fallback if image not found
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }} />
                              <Heart className="w-2.5 h-2.5 text-white fill-white hidden" />
                              <span className="text-white text-[9px] font-bold whitespace-nowrap">Membership</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pointer-events-auto flex items-center gap-2 mt-5">
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center -space-x-1 pointer-events-auto" onClick={() => setShowViewerList(prev => !prev)}>
                              {(activeViewers.length > 0 ? activeViewers.slice(0, 3) : VIEWER_POOL.slice(0, 3)).map((v, i) => {
                                const poolViewer = VIEWER_POOL.find(pv => pv.id === v.id);
                                const donated = poolViewer ? poolViewer.supportDays * (50 + Math.floor((poolViewer.level || 1) * 15)) : 0;
                                return (
                                  <div key={v.id} className="relative flex flex-col items-center" style={{ zIndex: 3 - i }}>
                                    <div className="relative w-7 h-7">
                                      <img src={v.avatar} alt={v.username} className="w-7 h-7 rounded-full border-2 border-[#E6B36A] object-cover" />
                                      <span className="absolute bottom-0 inset-x-0 flex items-center justify-center text-white text-[5px] font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">{formatCoinsShort(donated)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          <button onClick={() => setShowViewerList(prev => !prev)} className="flex items-center gap-0.5 pointer-events-auto">
                            <span className="text-white text-[9px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                        </div>
                        <button type="button" onClick={stopBroadcast} className="w-8 h-8 rounded-full bg-[#FF4D6A]/20 border border-[#FF4D6A]/40 flex items-center justify-center" title="End broadcast">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                        </button>
                      </div>
                    </div>
                    {currentUniverse && (
                      <div className="mt-0 pointer-events-auto px-2">
                        <div className="h-5 rounded-md bg-gradient-to-r from-red-700 via-red-600 to-red-700 border border-red-400/50 flex items-center justify-center px-2 gap-1">
                          <span className="text-black text-[12px] font-extrabold tracking-wide truncate">✨ {universeText} ✨</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="absolute top-0 left-0 right-0 z-[110] pointer-events-none">
                  <div className="px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="pointer-events-auto flex items-center gap-2">
                        {/* LUXURY CREATOR PROFILE BUTTON */}
                        <button type="button" onClick={() => openMiniProfile(myCreatorName)} className="pr-3 pl-2 py-2 hover:scale-105 transition-all animate-luxury-fade-in">
                          <div className="flex items-center gap-2">
                            <div 
                              className="relative z-10 w-11 h-11 rounded-full border-2 border-[#00f2ea] shadow-lg overflow-hidden flex-shrink-0 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                              onClick={(e) => { e.stopPropagation(); openMiniProfile(myCreatorName); }}
                            >
                              <img src={myAvatar} alt={myCreatorName} className="w-full h-full object-cover" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-[#00f2ea] to-[#00c2be] rounded-full border-2 border-black animate-premium-glow" />
                            </div>
                            <div className="min-w-0 flex items-center gap-2">
                              <p className="text-white font-black text-[14px] truncate max-w-[160px]">{myCreatorName}</p>
                              <button type="button" className="flex items-center gap-1 pointer-events-auto" onPointerDown={(e) => { spawnHeartFromClient(e.clientX, e.clientY); addLiveLikes(1); }}>
                                <Heart className="w-3.5 h-3.5 text-[#FF2D55]" strokeWidth={2.5} fill="#FF2D55" />
                                <span className="text-white/80 text-[10px] font-bold tabular-nums">{activeLikes.toLocaleString()}</span>
                              </button>
                            </div>
                              
                              <div className="flex items-center gap-2 mt-0.5 pointer-events-auto">
                                <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full px-2 py-0.5 border border-white/10 shadow-sm cursor-pointer" onClick={(e) => {
                                   e.stopPropagation();
                                   setShowRankingPanel(true);
                                }}>
                                  <Trophy className="w-2.5 h-2.5 text-white" />
                                  <span className="text-white text-[9px] font-bold whitespace-nowrap">52 Weekly Ranking &gt;</span>
                                </div>
                                <div className="flex items-center gap-1 bg-[#FF2D55] rounded-full px-2 py-0.5 border border-white/10 shadow-sm cursor-pointer pointer-events-auto" onClick={(e) => {
                                   e.stopPropagation();
                                   setShowFanClub(true);
                                }}>
                                  <Heart className="w-2.5 h-2.5 text-white fill-white" />
                                  <span className="text-white text-[9px] font-bold whitespace-nowrap">Join Super Fan</span>
                                </div>
                              </div>
                            </div>
                        </button>
                        {(() => {
                          const activeIds = new Set(activeViewers.map(v => v.id));
                          const redCount = VIEWER_POOL.filter(v => activeIds.has(v.id) || (v.lastVisitDaysAgo ?? 0) < 2).length;
                          const greyCount = VIEWER_POOL.filter(v => !activeIds.has(v.id) && (v.lastVisitDaysAgo ?? 0) >= 2).length;
                          return (
                            <button type="button" className="flex items-center gap-1 pointer-events-auto" onClick={(e) => { e.stopPropagation(); if (showMembershipBar) closeMembershipBar(); else openMembershipBar(); }}>
                              <Heart className={`w-3.5 h-3.5 drop-shadow-[0_0_3px_rgba(0,242,234,0.5)] transition-colors duration-300 ${membershipHeartActive ? 'text-[#00f2ea]' : 'text-[#00f2ea]'}`} strokeWidth={2} fill={membershipHeartActive ? '#00f2ea' : '#00f2ea'} />
                              <div className="flex flex-col leading-none gap-px">
                                <span className="text-[#00f2ea] text-[7px] font-bold tabular-nums">{redCount}</span>
                                <span className="text-[#6B7280] text-[7px] font-bold tabular-nums">{greyCount}</span>
                              </div>
                            </button>
                          );
                        })()}
                      </div>

                      <div className="pointer-events-auto flex flex-col items-center gap-2">
                        <div className="h-9 px-3 flex items-center gap-2 animate-luxury-fade-in">
                          <Flame className="w-4 h-4 text-[#00f2ea] animate-float" strokeWidth={2.5} />
                          <span className="text-white text-xs font-black">Popular</span>
                        </div>
                      </div>

                      <div className="pointer-events-auto flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowViewerList(prev => !prev)} className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 pointer-events-auto">
                            <div className="flex -space-x-1 pointer-events-auto" onClick={() => setShowViewerList(prev => !prev)}>
                              {activeViewers.slice(0, 3).map(v => (
                                <img key={v.id} src={v.avatar} alt="" className="w-5 h-5 rounded-full border border-black object-cover" />
                              ))}
                            </div>
                            <span className="text-white text-[9px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
                          </button>
                          <button type="button" onClick={() => navigate('/')} className="w-10 h-10 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                            <LogOut size={20} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {currentUniverse && (
                      <div className="mt-1 pointer-events-auto px-2">
                        <div className="h-9 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-red-700 border border-red-400/50 flex items-center justify-center px-4 gap-2">
                          <span className="text-white text-[14px] font-extrabold tracking-wide truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">✨ {universeText} ✨</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Floating Action Buttons */}
              <div className="absolute right-3 bottom-4 z-[150] flex flex-col items-center gap-3 pointer-events-none">
                <div className="flex flex-col items-center gap-3 pointer-events-auto">
                  {/* Broadcaster buttons moved to bottom-right zone */}
                </div>
              </div>
            </div>

            {/* MIDDLE ZONE: CHAT (Scrollable) */}
            <div 
              className="chat-zone absolute left-0 right-0 bottom-[calc(58px+env(safe-area-inset-bottom)+3mm)] h-[calc(40dvh-3cm)] max-h-[calc(40dvh-3cm)] overflow-y-auto pointer-events-auto z-[20] bg-transparent"
              onPointerDown={(e) => {
                // Allow tapping on chat area to trigger hearts (like functionality)
                // BUT only if not tapping on an interactive element inside
                if (e.target instanceof Element) {
                  const interactive = e.target.closest('button, a, input, textarea, select, [role="button"]');
                  if (interactive) return;
                }
                // Chat tap -> Always LIKE, never battle points
                handleLikeTap(e);
              }}
            >
            {isChatVisible && (
              <ChatOverlay
                messages={messages}
                variant="panel"
                onLike={() => addLiveLikes(1)}
                onHeartSpawn={(cx, cy) => handleLikeTap()}
                onProfileTap={(username) => openMiniProfile(username)}
              />
            )}
          </div>

      {/* BOTTOM ZONE: INPUT (Fixed) - Moved out to ensure top z-index */}
      <div className="bottom-zone flex-none pointer-events-auto bg-transparent px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 min-h-[50px] flex items-center absolute bottom-[3mm] left-0 right-0 z-[50]">
        <div className="w-full mx-auto">
          {/* Spectator Input & Actions */}
          {!isBroadcast && (
            <div className="flex items-center gap-2 w-full relative">
              {/* Emoji Picker Panel */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden pointer-events-auto z-[250]">
                  <div className="grid grid-cols-6 gap-2 p-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {CHAT_MESSAGES.emoji.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInputValue(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-xl hover:bg-white/10 rounded p-1 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 h-10 relative z-keyboard pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`text-white/60 hover:text-white transition flex-shrink-0 ${showEmojiPicker ? 'text-[#00f2ea]' : ''}`}
                >
                  <Smile size={20} />
                </button>
                <input 
                    type="text" 
                    inputMode="text"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    placeholder="Say something..." 
                    className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/40 min-w-0"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setShowEmojiPicker(false)}
                />
                <button type="submit" className="text-[#E6B36A] hover:text-[#E6B36A]/80 transition flex-shrink-0" title="Send">
                    <Send size={18} />
                </button>
              </form>
              
              <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
                <button type="button" onClick={() => setIsReportModalOpen(true)} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                <button type="button" onClick={handleShare} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Share2 size={16} className="text-white" />
                </button>
                <button type="button" onClick={() => setShowGiftPanel(true)} className="w-9 h-9 rounded-full bg-[#E6B36A]/20 backdrop-blur-md border border-[#E6B36A]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Gift size={16} className="text-[#E6B36A]" />
                </button>
                <button type="button" onPointerDown={(e) => { handleLikeTap(e); }} className="w-9 h-9 rounded-full bg-[#FF2D55]/20 backdrop-blur-md border border-[#FF2D55]/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <Heart size={16} fill="#FF2D55" className="text-[#FF2D55]" />
                </button>
              </div>
            </div>
          )}

          {isBroadcast && (
            <div className="flex items-center gap-3 pointer-events-auto translate-y-[12px]">
              {!currentGift ? (
                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 h-10 min-w-0">
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="off"
                    placeholder="Say something..."
                    className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/40 min-w-0"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <button type="submit" className="text-[#E6B36A] hover:text-[#E6B36A]/80 transition flex-shrink-0" title="Send">
                    <Send size={18} />
                  </button>
                </form>
              ) : (
                <div className="flex-1" />
              )}

              <div className="flex items-center justify-end gap-3 flex-shrink-0">
              {isBattleMode && battleWinner && (
                <button 
                  type="button" 
                  onClick={() => {
                    setBattleTime(300);
                    setMyScore(0);
                    setOpponentScore(0);
                    setPlayer3Score(0);
                    setPlayer4Score(0);
                    setBattleWinner(null);
                    setBattleCountdown(3);
                    reachedThresholdsRef.current.clear();
                  }} 
                  className="px-4 h-10 rounded-full bg-green-600/20 backdrop-blur-md border border-green-500/40 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <RefreshCw size={20} className="text-green-500 mr-2" />
                  <span className="text-green-500 text-xs font-bold">Rematch</span>
                </button>
              )}
              <button type="button" onClick={() => { if (!isBattleMode) toggleBattle(); else setIsFindCreatorsOpen(true); }} className="w-10 h-10 rounded-full bg-[#4DA6FF]/20 backdrop-blur-md border border-[#4DA6FF]/40 flex items-center justify-center shadow-lg">
                <Users size={20} className="text-[#4DA6FF]" />
              </button>
              <button type="button" onClick={() => { setGiftTarget('me'); setShowGiftPanel(true); }} className="w-10 h-10 rounded-full bg-[#00f2ea]/20 backdrop-blur-md border border-[#00f2ea]/40 flex items-center justify-center shadow-lg">
                <Gift size={20} className="text-[#00f2ea]" />
              </button>
              <button type="button" onClick={() => setShowSharePanel(true)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <Share2 size={20} className="text-white" />
              </button>
              <button type="button" onClick={() => setIsMoreMenuOpen(true)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <MoreVertical size={20} className="text-white" />
              </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS & OVERLAYS */}
      {isFindCreatorsOpen && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => {
              setIsFindCreatorsOpen(false);
              setCreatorQuery('');
            }}
          />
          <div
            className="bg-[#1a1a1a]/95 rounded-t-2xl h-[40dvh] max-h-[40dvh] flex flex-col shadow-2xl border-t border-white/10 pointer-events-auto w-full relative z-10 overflow-y-auto no-scrollbar pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4DA6FF]" strokeWidth={2} />
                <span className="text-white font-bold text-sm">Invite Creators</span>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 px-3 h-10 rounded-xl bg-black/50 border border-white/10 focus-within:border-[#4DA6FF]/50 transition-colors">
                <Search className="w-4 h-4 text-white/50" strokeWidth={2} />
                <input
                  value={creatorQuery}
                  onChange={(e) => setCreatorQuery(e.target.value)}
                  placeholder="Search creators..."
                  className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Invited Players Status */}
            {anySlotFilled && (
              <div className="px-4 pb-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">Lobby Status</p>
                  <div className="flex gap-3">
                    {battleSlots.map((slot, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        {slot.status === 'empty' ? (
                          <div className="w-10 h-10 rounded-full border border-dashed border-white/20 flex items-center justify-center bg-white/5">
                            <span className="text-white/30 text-lg">+</span>
                          </div>
                        ) : (
                          <div className="relative">
                            <img src={slot.avatar} alt={slot.name} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: slot.status === 'accepted' ? '#00C853' : '#00f2ea' }} />
                            {slot.status === 'invited' && (
                              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40">
                                <div className="w-4 h-4 border-2 border-[#00f2ea] border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {slot.status === 'accepted' && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                                <span className="text-white text-[8px] font-bold">✓</span>
                              </div>
                            )}
                          </div>
                        )}
                        <span className="text-white/60 text-[9px] font-bold truncate max-w-[50px]">
                          {slot.status === 'empty' ? `Slot ${i + 1}` : slot.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Creator list */}
            <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'none' }}>
              <div className="space-y-1 pb-4">
                {filteredCreators.map((c) => {
                  const slotStatus = battleSlots.find(s => s.name === c.name)?.status;
                  const isInvited = slotStatus === 'invited';
                  const isAccepted = slotStatus === 'accepted';
                  const allFull = battleSlots.every(s => s.status !== 'empty');

                  return (
                    <div
                      key={c.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`https://i.pravatar.cc/150?u=${encodeURIComponent(c.name)}`}
                          alt={c.name}
                          className="w-10 h-10 rounded-full object-cover bg-white/10"
                        />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{c.name}</p>
                          <p className="text-white/50 text-[10px] font-medium">{c.followers} followers</p>
                        </div>
                      </div>

                      {isAccepted ? (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full border border-green-500/30">
                          Joined ✓
                        </span>
                      ) : isInvited ? (
                        <span className="px-3 py-1 bg-[#00f2ea]/20 text-[#00f2ea] text-[10px] font-bold rounded-full border border-[#00f2ea]/30 flex items-center gap-1.5">
                          <div className="w-2 h-2 border border-[#00f2ea] border-t-transparent rounded-full animate-spin" />
                          Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inviteCreatorToSlot(c.name)}
                          disabled={allFull}
                          className={`px-4 py-1.5 text-[11px] font-bold rounded-full transition-all active:scale-95 ${
                            allFull 
                              ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                              : 'bg-[#4DA6FF] hover:bg-[#3b8ad9] text-white shadow-lg shadow-blue-500/20'
                          }`}
                        >
                          Invite
                        </button>
                      )}
                    </div>
                  );
                })}

                {filteredCreators.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-white/20" />
                    </div>
                    <p className="text-white/40 text-xs font-medium">No creators found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status bar & Start Button */}
            {battleSlots.some(s => s.status !== 'empty') && (
              <div className="p-4 border-t border-white/10 bg-[#1a1a1a]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/50 text-xs font-bold">
                    Match Status
                  </span>
                  <span className="text-white text-xs font-bold">
                    {battleSlots.filter(s => s.status === 'accepted').length} Ready <span className="text-white/30">•</span> {battleSlots.filter(s => s.status === 'invited').length} Waiting
                  </span>
                </div>
                
                {battleSlots.some(s => s.status === 'accepted') && (
                  <button
                    type="button"
                    onClick={() => {
                      setBattleCountdown(3);
                      setIsFindCreatorsOpen(false);
                    }}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-black rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <span>Start Match</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {miniProfile && (
          <div className="absolute inset-0 z-[10000] flex flex-col justify-end">
            <div 
              className="absolute inset-0 pointer-events-auto" 
              onClick={closeMiniProfile}
            />
            <motion.div
              className="bg-[#1a1a1a] rounded-t-2xl border-t border-white/10 px-4 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] pointer-events-auto shadow-2xl relative z-10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative -mt-6 flex-shrink-0">
                    <img src={miniProfile.avatar} alt={miniProfile.username} className="w-20 h-20 rounded-full object-cover border-4 border-[#1a1a1a] aspect-square" />
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="text-white font-black text-[16px] truncate">{miniProfile.username}</div>
                    <div className="text-white/70 text-[12px] font-bold">
                      {typeof miniProfile.level === 'number' ? (
                        <span className="inline-flex items-center gap-2">
                          <LevelBadge level={miniProfile.level} size={16} layout="fixed" />
                          <span>Level {miniProfile.level}</span>
                        </span>
                      ) : (
                        'Level —'
                      )}
                      {miniProfile.coins != null ? ` • 🪙 ${formatCoinsShort(miniProfile.coins)}` : ''}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/50">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">1.2k</span>
                        <span>Followers</span>
                      </div>
                      <div className="w-px h-2 bg-white/20" />
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold tabular-nums">458</span>
                        <span>Following</span>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-white/80 leading-snug line-clamp-2">
                      Welcome to my stream! 🎵 Music lover, gamer & content creator. Let's vibe! ✨
                    </div>

                    {miniProfile.donated != null && miniProfile.donated > 0 && (
                      <div className="text-[#00f2ea] text-[11px] font-bold mt-2 pt-2 border-t border-white/10">
                        Donated: {formatCoinsShort(miniProfile.donated)} coins
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2">
                <button type="button" onClick={() => alert('Followed')} className="h-9 rounded-lg bg-[#00f2ea] text-black text-[11px] font-black hover:bg-[#00f2ea]/90 active:scale-95 transition-all">
                  Follow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGiftPanel(true);
                    closeMiniProfile();
                  }}
                  className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Gift
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    closeMiniProfile();
                    navigate(`/profile/${miniProfile.username}`);
                  }}
                  className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all"
                >
                  Profile
                </button>
                <button type="button" onClick={handleShare} className="h-9 rounded-lg bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 active:scale-95 transition-all">
                  Share
                </button>
                <button type="button" onClick={() => alert('Blocked')} className="h-9 rounded-lg bg-red-950/50 text-red-400 text-[11px] font-bold border border-red-900/50 hover:bg-red-900/50 active:scale-95 transition-all">
                  Block
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ VIEWER LIST PANEL (Restored) ═══ */}
      {showViewerList && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => setShowViewerList(false)}
          />
          <div
            className="bg-[#1a1a1a]/95 rounded-t-2xl h-[40dvh] max-h-[40dvh] flex flex-col shadow-2xl border-t border-white/10 pointer-events-auto w-full relative z-10 overflow-y-auto no-scrollbar pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">Live Gifters</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-white/70 text-[8px] font-bold tabular-nums">{formatCountShort(viewerCount)}</span>
              </div>
            </div>
            {/* Content */}
            <div className="max-h-[40vh] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {activeViewers
                .map(v => {
                  const poolViewer = VIEWER_POOL.find(pv => pv.id === v.id);
                  const donated = poolViewer ? poolViewer.supportDays * (50 + Math.floor((poolViewer.level || 1) * 15)) : 0;
                  return { ...v, donated };
                })
                .sort((a, b) => b.donated - a.donated)
                .map((v, idx) => (
                  <div key={v.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5">
                    <div className="relative flex-shrink-0">
                      <img src={v.avatar} alt={v.displayName} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                      {idx < 10 && (
                        <span className="absolute -top-0.5 -left-0.5 bg-[#00f2ea] text-black text-[6px] font-black w-3 h-3 rounded-full flex items-center justify-center">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white text-[11px] font-semibold truncate">{v.displayName}</span>
                        <span className="text-white/40 text-[9px]">{v.country}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] font-bold text-[#00f2ea] bg-[#00f2ea]/10 px-1 py-px rounded-full">LVL {v.level}</span>
                        {idx < 10 && v.donated > 0 && (
                          <span className="text-[8px] font-bold text-[#FF2D55]">{formatCoinsShort(v.donated)}</span>
                        )}
                      </div>
                    </div>
                    <button className="px-2 py-0.5 rounded-full bg-[#00f2ea]/15 border border-[#00f2ea]/25 text-[#00f2ea] text-[9px] font-bold hover:bg-[#00f2ea]/25 transition-colors">
                      Follow
                    </button>
                  </div>
                ))}
              {activeViewers.length === 0 && (
                <div className="py-6 text-center text-white/40 text-xs">
                  Viewers are joining...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      


      {/* ═══ JOIN ANIMATION OVERLAY ═══ */}
      {showJoinAnimation && (
        <div className="absolute inset-0 z-[99999] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
            <img 
              src="/icons/Membership.png" 
              alt="Membership" 
              className="w-20 h-20 object-contain drop-shadow-2xl animate-pulse"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <Heart className="w-20 h-20 text-[#FF2D55] fill-[#FF2D55] drop-shadow-2xl animate-pulse hidden" />
            <span className="text-white font-black text-2xl mt-2 drop-shadow-lg tracking-wider animate-bounce">JOIN</span>
          </div>
        </div>
      )}

      {/* ═══ TEAM STATUS PANEL (Heart Icon) ═══ */}
      {showTeamStatus && (
        <div className="absolute inset-0 z-[9999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => setShowTeamStatus(false)}
          />
          
          <div
            className="relative w-full z-10 bg-[#1a1a1a] rounded-t-2xl max-h-[40dvh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl border-t border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#FF2D55]" strokeWidth={2} fill="#FF2D55" />
                <span className="text-white font-bold text-sm">Your Team Status</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="max-h-[40vh] overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
               {/* Team Status Card */}
               <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-20 h-20 bg-[#FF2D55]/20 rounded-full -mr-6 -mt-6 blur-xl" />
                 <div className="flex items-center gap-4 relative z-10">
                   <div 
                     className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF2D55] to-[#FF6B00] flex items-center justify-center border-2 border-white/10 shadow-lg cursor-pointer active:scale-95 transition-transform"
                     onClick={(e) => {
                       e.stopPropagation();
                       setShowJoinAnimation(true);
                       setTimeout(() => setShowJoinAnimation(false), 2000);
                     }}
                   >
                     <Heart className="w-6 h-6 text-white fill-white" />
                   </div>
                   <div>
                     <div className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Current Status</div>
                     <div className="text-white font-bold text-base">
                      {myHeartCount === 0 ? 'New Viewer' : myHeartCount < 5 ? 'Rising Fan' : myHeartCount < 20 ? 'Loyal Member' : 'Super Fan'}
                    </div>
                    <div className="text-[#00f2ea] text-[10px] font-bold mt-0.5">
                      {myHeartCount} Hearts Sent • {myHeartCount} Days Supported
                    </div>
                   </div>
                 </div>
               </div>
               
               <p className="text-white/40 text-xs text-center mt-4 px-4">
                 Join not tap tap one single heart
               </p>

               {/* Recent Supporters List */}
               <div className="mt-6">
                 <h4 className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-3 px-1">Recent Supporters</h4>
                 <div className="space-y-1">
                   {/* Show current user first if they joined */}
                   {hasJoinedToday && (
                     <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/10 border border-white/20">
                        <div className="relative">
                          <img src={'https://i.pravatar.cc/150?img=68'} alt="You" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                          <div className="absolute -bottom-1 -right-1 bg-[#FF2D55] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#1a1a1a]">
                            <Heart size={8} className="text-white fill-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                        <div className="text-xs font-bold text-white">You</div>
                        <div className="text-[10px] text-[#00f2ea]">Just joined the team!</div>
                      </div>
                        <div className="text-white/40 text-[9px]">Now</div>
                     </div>
                   )}
                   
                   {/* Simulated list of other supporters */}
                   {VIEWER_POOL.slice(0, 8).map((v, i) => (
                     <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="relative">
                          <img src={v.avatar} alt={v.username} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                          {/* Randomly show heart icon on some users to simulate they joined */}
                          {i % 3 === 0 && (
                            <div className="absolute -bottom-1 -right-1 bg-[#FF2D55] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#1a1a1a]">
                              <Heart size={8} className="text-white fill-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white/90">{v.displayName}</div>
                          <div className="text-[10px] text-white/40">Level {v.level} • {v.country}</div>
                        </div>
                        <div className="text-white/30 text-[9px]">{i + 1}m ago</div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUPER FAN GOAL PANEL (Membership) ═══ */}
      {showFanClub && (
        <div className="absolute inset-0 z-[9999] flex flex-col justify-end">
          {/* Backdrop - tap to close */}
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => setShowFanClub(false)}
          />
          
          <div
            className="relative w-full z-10 bg-[#1a1a1a] rounded-t-2xl max-h-[40dvh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl border-t border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#FF2D55]" strokeWidth={2} fill="#FF2D55" />
                <span className="text-white font-bold text-sm">Super Fan Goal</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="max-h-[40vh] overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="flex flex-col gap-4">
                {/* Subscription Banner */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 shadow-lg border border-white/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-white font-bold text-lg">Membership</h3>
                        <p className="text-white/80 text-xs">Unlock photo stickers & exclusive perks</p>
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                        <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-1 mb-4">
                      <span className="text-3xl font-black text-white">£3.00</span>
                      <span className="text-white/70 text-sm font-medium mb-1">/ month</span>
                    </div>

                    <button
                      onClick={handleSubscribe}
                      disabled={isSubscribing}
                      className="w-full py-3 bg-white text-[#FF2D55] font-black text-sm uppercase tracking-wide rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubscribing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#FF2D55]/30 border-t-[#FF2D55] rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Subscribe Now</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Photo Stickers - Only for Subscribers */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                      Photo Stickers
                    </h3>
                    <span className="bg-[#00f2ea]/20 text-[#00f2ea] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#00f2ea]/30">SUBSCRIBER ONLY</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {['🔥', '💎', '👑', '🚀', '💯', '🎉', '💖', '👀'].map((emoji, i) => (
                      <button
                        key={i}
                        className="aspect-square rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-2xl border border-white/5 relative overflow-hidden group"
                        onClick={() => {
                          // Simulate sending a sticker
                          const newMessage: LiveMessage = {
                            id: Date.now().toString(),
                            username: 'You',
                            text: emoji, // In a real app this would be an image URL
                            level: userLevel,
                            isGift: false, // Could be treated as a special message type
                            avatar: 'https://i.pravatar.cc/150?img=68', // Fallback for now to avoid TS issues with User type
                            isSystem: false
                          };
                          setMessages(prev => [...prev, newMessage]);
                          setShowFanClub(false); // Close panel after sending
                        }}
                      >
                        <span className="group-hover:scale-125 transition-transform duration-200">{emoji}</span>
                        {/* Lock overlay if not subscribed (simulated check - assume not subscribed for demo if isSubscribing is false) */}
                        {!isSubscribing && ( // In real app, check actual subscription status
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                    {/* Add Custom Sticker Upload Button */}
                    <button
                      className="aspect-square rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center border border-white/5 relative overflow-hidden group"
                      onClick={() => {
                        if (!isSubscribing) return;
                        // Trigger file input
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const newMessage: LiveMessage = {
                                id: Date.now().toString(),
                                username: 'You',
                                text: ev.target?.result as string, // Data URL
                                level: userLevel,
                                isGift: false, 
                                avatar: 'https://i.pravatar.cc/150?img=68',
                                isSystem: false
                              };
                              setMessages(prev => [...prev, newMessage]);
                              setShowFanClub(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <PlusCircle size={20} className="text-white/50 group-hover:text-white transition-colors" />
                        <span className="text-[8px] text-white/50 font-bold uppercase">Upload</span>
                      </div>
                       {/* Lock overlay if not subscribed */}
                       {!isSubscribing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </div>
                        )}
                    </button>
                  </div>
                  <p className="text-white/40 text-[10px] text-center mt-3">Subscribe to unlock photo stickers and send them in chat!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}





      {isMoreMenuOpen && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div
            className="bg-[#1a1a1a]/95 rounded-t-2xl h-[40dvh] max-h-[40dvh] flex flex-col shadow-2xl border-t border-white/10 pointer-events-auto w-full relative z-10 overflow-y-auto no-scrollbar pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">More Options</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-2 overflow-y-auto">
              {isBattleMode && battleWinner && isBroadcast && (
                <button
                  type="button"
                  onClick={() => {
                    setBattleTime(300);
                    setMyScore(0);
                    setOpponentScore(0);
                    setPlayer3Score(0);
                    setPlayer4Score(0);
                    setBattleWinner(null);
                    setBattleCountdown(3);
                    reachedThresholdsRef.current.clear();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-green-500 hover:bg-white/5 rounded-xl"
                >
                  <RefreshCw className="w-5 h-5" strokeWidth={2} />
                  <span className="text-sm font-bold">Rematch</span>
                </button>
              )}
              
              {isBattleMode && isBroadcast && !battleWinner && battleTime > 0 && (
                <button
                  type="button"
                  onClick={() => { startSpeedChallenge(); setIsMoreMenuOpen(false); }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-[#00f2ea] hover:bg-white/5 rounded-xl"
                >
                  <Zap className="w-5 h-5" strokeWidth={2} />
                  <span className="text-sm font-bold text-[#00f2ea]">Start Speed Challenge</span>
                </button>
              )}

              <button
                type="button"
                disabled={!isBroadcast}
                onClick={() => { flipCamera(); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white disabled:opacity-50 hover:bg-white/5 rounded-xl"
              >
                <RefreshCw className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">Flip camera</span>
              </button>

              <button
                type="button"
                disabled={!isBroadcast}
                onClick={() => { toggleMic(); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white disabled:opacity-50 hover:bg-white/5 rounded-xl"
              >
                {isMicMuted ? <MicOff className="w-5 h-5" strokeWidth={2} /> : <Mic className="w-5 h-5" strokeWidth={2} />}
                <span className="text-sm font-bold">{isMicMuted ? 'Unmute mic' : 'Mute mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsLiveSettingsOpen(true); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-white/5 rounded-xl"
              >
                <Settings2 className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">Live settings</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsChatVisible((v) => !v); setIsMoreMenuOpen(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-white hover:bg-white/5 rounded-xl"
              >
                <MessageCircle className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">{isChatVisible ? 'Hide chat' : 'Show chat'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsMoreMenuOpen(false); setCoinPassword(''); setShowCoinModal(true); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-[#00f2ea] hover:bg-white/5 rounded-xl"
              >
                <span className="text-xl">💰</span>
                <span className="text-sm font-bold">Reload Coins</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coin Reload Password Modal */}
      {showCoinModal && (
        <div
          className="absolute inset-0 z-[800] bg-black/80 flex items-center justify-center pointer-events-auto"
          onClick={() => setShowCoinModal(false)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 mx-4 w-full max-w-[320px] border border-[#00f2ea]/30 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[#00f2ea] text-lg font-bold text-center mb-4">Enter Password</h3>
            <input
              type="password"
              value={coinPassword}
              onChange={(e) => setCoinPassword(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  if (coinPassword === 'elixstar2026') {
                    setCoinBalance(99999999);
                    if (user?.id) {
                      await supabase.from('profiles').update({ coins: 99999999 }).eq('user_id', user.id);
                    }
                    setShowCoinModal(false);
                    setCoinPassword('');
                  }
                }
              }}
              placeholder="Password..."
              className="w-full px-4 py-3 bg-black/50 border border-[#00f2ea]/40 rounded-xl text-white text-center outline-none focus:border-[#00f2ea] transition"
              autoFocus
            />
            <button
              type="button"
              onClick={async () => {
                if (coinPassword === 'elixstar2026') {
                  setCoinBalance(99999999);
                  if (user?.id) {
                    await supabase.from('profiles').update({ coins: 99999999 }).eq('user_id', user.id);
                  }
                  setShowCoinModal(false);
                  setCoinPassword('');
                }
              }}
              className="w-full mt-3 py-3 bg-[#00f2ea] text-black font-bold rounded-xl hover:bg-[#00f2ea]/90 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {isLiveSettingsOpen && (
        <div
          className="absolute inset-0 z-[710] bg-black pointer-events-auto"
          onClick={() => setIsLiveSettingsOpen(false)}
          role="button"
          tabIndex={-1}
        >
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pointer-events-auto">
            <div
              className="mx-auto w-full bg-black overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="button"
              tabIndex={-1}
            >
              <div className="px-4 py-3 flex items-center justify-between text-[#00f2ea]">
                <div className="flex flex-col">
                  <span className="font-extrabold">Live settings</span>
                  <span className="text-[10px] text-white/40 font-mono">v1.5 (Clean UI)</span>
                </div>
                <button type="button" onClick={() => setIsLiveSettingsOpen(false)} className="p-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00f2ea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="h-px bg-[#00f2ea]" />
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleMic();
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-[#00f2ea] hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    {isMicMuted ? <MicOff className="w-5 h-5" strokeWidth={2} /> : <Mic className="w-5 h-5" strokeWidth={2} />}
                    <span className="font-semibold">{isMicMuted ? 'Unmute microphone' : 'Mute microphone'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsChatVisible((v) => !v);
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-[#00f2ea] hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5" strokeWidth={2} />
                    <span className="font-semibold">{isChatVisible ? 'Hide comments' : 'Show comments'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleShare();
                    setIsLiveSettingsOpen(false);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-[#00f2ea] hover:brightness-125"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-5 h-5" strokeWidth={2} />
                    <span className="font-semibold">Share</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Gift Overlay Animation */}
      <GiftAnimationOverlay streamId={effectiveStreamId} />

      {/* Gift Panel Slide-up */}
      {showGiftPanel && (
        <>
          <div 
            className="absolute inset-0 bg-black/40 pointer-events-auto"
            style={{ zIndex: 99998 }}
            onClick={() => setShowGiftPanel(false)}
          />
          <div 
            className="absolute bottom-0 left-0 right-0 h-[40dvh] z-[999999] pointer-events-auto"
          >
            <GiftPanel 
              onSelectGift={handleSendGift} 
              userCoins={coinBalance} 
              onRechargeSuccess={(newBalance) => setCoinBalance(newBalance)}
            />
          </div>
        </>
      )}

      {/* Full-screen Video Effect Overlay (Behind controls but above video) */}
      <GiftOverlay 
        videoSrc={currentGift} 
        onEnded={handleGiftEnded} 
        isBattleMode={isBattleMode}
      />
      
      {/* ═══ SHARE PANEL ═══ */}

      {/* ═══ SHARE PANEL ═══ */}
      {showSharePanel && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end">
          <div 
            className="absolute inset-0 pointer-events-auto" 
            onClick={() => setShowSharePanel(false)}
          />
          <div className="relative w-full z-10 bg-[#1a1a1a] rounded-t-2xl p-4 pb-safe flex flex-col gap-1 shadow-2xl border-t border-white/10 pointer-events-auto max-h-[40dvh] overflow-y-auto no-scrollbar">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-white font-bold whitespace-nowrap">Share to</h3>
              <div className="flex-none w-[120px] bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2">
                 <Search className="w-3.5 h-3.5 text-white/30" />
                 <input 
                   value={shareQuery}
                   onChange={(e) => setShareQuery(e.target.value)}
                   placeholder="Search..."
                   className="bg-transparent text-white text-xs outline-none w-full placeholder:text-white/20"
                 />
              </div>
            </div>
            
            {/* Followers List */}
            <div className="w-full overflow-hidden shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
                {VIEWER_POOL.filter(v => v.displayName.toLowerCase().includes(shareQuery.toLowerCase())).map((user) => (
                  <button 
                    key={user.id} 
                    className="flex flex-col items-center gap-1 min-w-[56px] active:scale-95 transition-transform"
                    onClick={() => {
                      alert(`Sent to ${user.displayName}`);
                      setShowSharePanel(false);
                    }}
                  >
                    <div className="relative">
                      <img src={user.avatar} alt={user.username} className="w-12 h-12 rounded-full object-cover bg-white/10 border border-white/10" />
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#FF2D55] rounded-full flex items-center justify-center border-2 border-[#1a1a1a]">
                        <Send size={7} className="text-white" />
                      </div>
                    </div>
                    <span className="text-white text-[9px] font-bold truncate max-w-[56px]">{user.displayName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
              {[
                { name: 'WhatsApp', color: '#25D366', icon: <MessageCircle size={24} /> },
                { name: 'Facebook', color: '#1877F2', icon: <Share2 size={24} /> },
                { name: 'Instagram', color: '#E4405F', icon: <Share2 size={24} /> },
                { name: 'GitHub', color: '#333333', icon: <Github size={24} /> },
                { name: 'Copy Link', color: '#00f2ea', icon: <Copy size={24} /> },
                { name: 'Message', color: '#00C853', icon: <MessageCircle size={24} /> },
              ].map((item) => (
                <button 
                  key={item.name}
                  onClick={() => {
                    if (item.name === 'Copy Link') {
                       const shareUrl = `https://app.com/live/${effectiveStreamId}`;
                       navigator.clipboard.writeText(shareUrl);
                       alert('Link copied!');
                    }
                    setShowSharePanel(false);
                  }}
                  className="flex flex-col items-center gap-1 min-w-[60px]"
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.icon}
                  </div>
                  <span className="text-white/70 text-[10px]">{item.name}</span>
                </button>
              ))}
            </div>

            {/* Actions Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
              {[
                { name: 'Promote', color: '#00f2ea', icon: <TrendingUp size={24} className="text-white" />, action: () => alert('Promote panel opening...') },
                { name: 'Report', color: '#EF4444', icon: <AlertTriangle size={24} className="text-white" />, action: () => setIsReportModalOpen(true) },
                { name: 'Add Story', color: '#3B82F6', icon: <PlusCircle size={24} className="text-white" />, action: () => alert('Adding to story...') },
                { name: 'Settings', color: '#6B7280', icon: <Settings2 size={24} className="text-white" />, action: () => setIsLiveSettingsOpen(true) },
              ].map((item) => (
                <button 
                  key={item.name}
                  onClick={() => {
                    item.action();
                    setShowSharePanel(false);
                  }}
                  className="flex flex-col items-center gap-1 min-w-[60px]"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    {item.icon}
                  </div>
                  <span className="text-white/70 text-[10px]">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        videoId={effectiveStreamId || ''}
        contentType="live"
      />

      {/* Combo Button Overlay - Moved to top-most layer */}
      <AnimatePresence>
        {showComboButton && lastSentGift && (
            <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute right-4 bottom-[120px] z-[100000] flex flex-col items-center pointer-events-auto"
            >
                <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComboClick();
                    }}
                    className="w-16 h-14 rounded-full bg-gradient-to-r from-secondary to-orange-500 flex flex-col items-center justify-center animate-pulse active:scale-90 transition-transform shadow-[0_0_20px_rgba(0,242,234,0.5)] border-2 border-white/30"
                >
                    <span className="text-xl font-black italic text-white drop-shadow-md">x{comboCount}</span>
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Combo</span>
                </button>
                <div className="mt-1 px-3 py-1 text-[10px] text-secondary font-bold bg-black/60 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                    Send {lastSentGift.name}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
