// Deep Link Handler

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export const useDeepLinks = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
      if (cancelled) return;
      const url = event.url;
      
      const videoMatch = url.match(/(?:elixstar|app):\/\/video\/([^?]+)/);
      if (videoMatch) { navigate(`/video/${videoMatch[1]}`); return; }
      
      const userMatch = url.match(/(?:elixstar|app):\/\/user\/([^?]+)/);
      if (userMatch) { navigate(`/profile/${userMatch[1]}`); return; }
      
      const liveMatch = url.match(/(?:elixstar|app):\/\/live\/([^?]+)/);
      if (liveMatch) { navigate(`/live/${liveMatch[1]}`); return; }
      
      const hashtagMatch = url.match(/(?:elixstar|app):\/\/hashtag\/([^?]+)/);
      if (hashtagMatch) { navigate(`/hashtag/${hashtagMatch[1]}`); return; }
      
      navigate('/feed');
    }).then((h) => {
      if (cancelled) {
        void h.remove();
      } else {
        handle = h;
      }
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [navigate]);
};

// Generate shareable deep link
export const generateDeepLink = (type: 'video' | 'user' | 'live' | 'hashtag', id: string): string => {
  return `elixstar://${type}/${id}`;
};

// Generate web fallback link
export const generateWebLink = (type: 'video' | 'user' | 'live' | 'hashtag', id: string): string => {
  const baseUrl = 'https://elixstar.app';
  const pathSegment = type === 'user' ? 'profile' : type;
  return `${baseUrl}/${pathSegment}/${id}`;
};

// Generate universal link (tries deep link, falls back to web)
export const generateUniversalLink = (type: 'video' | 'user' | 'live' | 'hashtag', id: string): string => {
  if (typeof window !== 'undefined') {
    const isNative = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    if (isNative) {
      return generateDeepLink(type, id);
    }
  }
  return generateWebLink(type, id);
};
