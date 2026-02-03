'use client';

import { useCallback } from 'react';
import { useMessengerState } from './useMessengerState';

export function useChats() {
  const { chats, isLoading, fetchChats } = useMessengerState();

  const getChatById = useCallback((id: string) => {
    return chats.find((chat) => chat.id === id);
  }, [chats]);

  return {
    chats,
    loading: isLoading,
    error: null, // Error handling is now central or per-action
    getChatById,
    refresh: fetchChats,
  };
}
