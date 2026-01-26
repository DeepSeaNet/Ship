import { useState, useEffect, useCallback } from 'react';
import { Message } from './messengerTypes';
import { useMessengerState } from './useMessengerState';
import { invoke } from '@tauri-apps/api/core';

// Helper for media URLs
const createMediaUrl = (mediaData: string | undefined): string | undefined => {
  if (!mediaData) return undefined;
  if (mediaData.startsWith('data:') || mediaData.startsWith('http')) return mediaData;
  return `data:image/png;base64,${mediaData}`;
};

export function useMessages(chatId: string | null) {
  const { uiState, messagesByChat, users, markChatAsLoaded, setMessagesForChat, upsertUser } = useMessengerState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(50);

  const messages = chatId ? messagesByChat[chatId] || [] : [];
  const isLoaded = chatId ? uiState.loadedChatIds.includes(chatId) : false;

  const loadMessages = useCallback(async () => {
    if (!chatId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await invoke<any>('get_group_messages', {
        groupId: chatId,
      });

      if (!response.messages) {
        setLoading(false);
        return;
      }

      const formattedMessages: Message[] = response.messages.map((msg: any) => {
        const senderId = msg.sender_id?.toString() || '0';
        const sender = users[senderId];

        // If sender name is missing, we'll need to fetch it (handled below)
        const senderName = msg.sender_name || sender?.name || 'User ' + senderId;

        return {
          id: msg.message_id?.toString() || '',
          chatId: msg.chat_id || chatId,
          senderId,
          senderName,
          content: msg.text || msg.content || '',
          timestamp: msg.timestamp
            ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: senderId === localStorage.getItem('userId'),
          status: 'sent',
          media_name: msg.media_name,
          //media: createMediaUrl(msg.media_data),
          reply_to: msg.reply_message_id,
          edited: !!msg.edit_date,
          expires: msg.expires,
          is_file: msg.is_file,
        };
      });

      // Fetch missing users
      const missingUserIds = [...new Set(formattedMessages
        .map(m => m.senderId)
        .filter(id => id !== '0' && !users[id]))];

      if (missingUserIds.length > 0) {
        Promise.all(missingUserIds.map(async (id) => {
          try {
            const userInfo = await invoke<any>('get_user_info', { userId: parseInt(id) });
            if (userInfo) {
              upsertUser({
                id: id,
                name: userInfo.username || userInfo.name || 'User ' + id,
                avatar: createMediaUrl(userInfo.avatar),
              });
            }
          } catch (e) {
            console.error(`Failed to fetch user info for ${id}:`, e);
          }
        }));
      }

      console.log('Formatted messages:', formattedMessages);

      // Update the global state with fetched messages
      setMessagesForChat(chatId, formattedMessages);
      markChatAsLoaded(chatId);

      // We should ideally have a setMessagesByChat in useMessengerState
      // But let's assume currentMessages are already in state or we just return them

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error fetching messages:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [chatId, markChatAsLoaded]);

  useEffect(() => {
    if (!chatId || isLoaded) {
      return;
    }
    loadMessages();
  }, [chatId, isLoaded, loadMessages]);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + 50);
  }, []);

  return {
    messages: messages.slice(-displayCount),
    allMessages: messages,
    loading,
    error,
    refresh: loadMessages,
    loadMore,
    hasMore: displayCount < messages.length,
  };
}
