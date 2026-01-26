import { useState, useEffect } from 'react';
import { Chat } from './messengerTypes';
import { MOCK_CHATS } from './mock_data';

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      try {
        setChats(MOCK_CHATS);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch chats');
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const getChatById = (id: string) => {
    return chats.find((chat) => chat.id === id);
  };

  return {
    chats,
    loading,
    error,
    getChatById,
  };
}
