import { useState } from 'react';
import { Message } from './messengerTypes';
import { useMessengerState } from './useMessengerState';

export function useSendMessage() {
  const { addMessage, updateMessageStatus } = useMessengerState();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (
    chatId: string,
    content: string
  ): Promise<Message | null> => {
    if (!content.trim()) {
      setError('Message cannot be empty');
      return null;
    }

    setSending(true);
    setError(null);

    const messageId = `msg_${Date.now()}`;
    const newMessage: Message = {
      id: messageId,
      senderId: 'current_user',
      senderName: 'You',
      content: content.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isOwn: true,
      status: 'sending',
    };

    // Optimistically add the message
    addMessage(chatId, newMessage);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Update status to 'sent'
      updateMessageStatus(chatId, messageId, 'sent');

      setSending(false);
      return newMessage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setSending(false);
      return null;
    }
  };

  return {
    sendMessage,
    sending,
    error,
  };
}
