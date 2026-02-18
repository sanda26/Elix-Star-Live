// Deep Link Handler

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

export const useDeepLinks = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle app:// deep links
    CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
      const url = event.url;
      
      // Parse elixstar://video/123 or app://video/123
      const videoMatch = url.match(/(?:elixstar|app):\/\/video\/([^?]+)/);
      if (videoMatch) {
        navigate(`/video/${videoMatch[1]}`);
        return;
      }
      
      // Parse elixstar://user/username
      const userMatch = url.match(/(?:elixstar|app):\/\/user\/([^?]+)/);
      if (userMatch) {
        navigate(`/user/${userMatch[1]}`);
        return;
      }
      
      // Parse elixstar://live/roomId
      const liveMatch = url.match(/(?:elixstar|app):\/\/live\/([^?]+)/);
      if (liveMatch) {
        navigate(`/live/${liveMatch[1]}`);
        return;
      }
      
      // Parse elixstar://hashtag/tag
      const hashtagMatch = url.match(/(?:elixstar|app):\/\/hashtag\/([^?]+)/);
      if (hashtagMatch) {
        navigate(`/hashtag/${hashtagMatch[1]}`);
        return;
      }
      
      // Default: go to feed
      navigate('/feed');
    });

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [navigate]);
};

// Generate shareable deep link
export const generateDeepLink = (type: 'video' | 'user' | 'live' | 'hashtag', id: string): string => {
  return `elixstar://${type}/${id}`;
};

// Generate web fallback link
export const generateWebLink = (type: 'video' | 'user' | 'live' | 'hashtag', id: string): string => {
  const baseUrl = 'https://elixstar.app'; // Replace with your domain
  return `${baseUrl}/${type}/${id}`;
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
