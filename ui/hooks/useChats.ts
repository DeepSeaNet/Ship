'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chat } from './messengerTypes';
import { useGroups } from './useGroups';
import { invoke } from '@tauri-apps/api/core';

export function useChats() {
  const { loadGroups, loading: groupsLoading } = useGroups();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllChats = useCallback(async () => {
    setLoading(true);
    try {
      // Load groups
      const loadedGroups = await loadGroups();

      // Load private chats (if backend supports it, currently returns empty)
      const privateChats = await invoke<any[]>('get_chats');

      const formattedPrivateChats: Chat[] = privateChats.map((chat: any) => ({
        id: chat.id,
        name: chat.name,
        avatar: chat.avatar,
        unreadCount: chat.unread_count || 0,
        isGroup: false,
        lastMessage: chat.last_message?.text,
        lastMessageTime: chat.last_message?.timestamp,
      }));

      const allChats = [...loadedGroups, ...formattedPrivateChats].sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });

      setChats(allChats);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  }, [loadGroups]);

  useEffect(() => {
    fetchAllChats();
  }, [fetchAllChats]);

  const getChatById = (id: string) => {
    return chats.find((chat) => chat.id === id);
  };

  return {
    chats,
    loading: loading || groupsLoading,
    error,
    getChatById,
    refresh: fetchAllChats,
  };
}
