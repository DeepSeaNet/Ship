import { useState, useEffect } from 'react';
import { Message } from './messengerTypes';
import { useMessengerState } from './useMessengerState';

export function useMessages(chatId: string | null) {
  const { uiState, messagesByChat, markChatAsLoaded } = useMessengerState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = chatId ? messagesByChat[chatId] || [] : [];
  const isLoaded = chatId ? uiState.loadedChatIds.includes(chatId) : false;

  useEffect(() => {
    if (!chatId || isLoaded) {
      return;
    }

    setLoading(true);
    // Simulate API call delay
    const timer = setTimeout(() => {
      markChatAsLoaded(chatId);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [chatId, isLoaded, markChatAsLoaded]);

  return {
    messages,
    loading,
    error,
  };
}
