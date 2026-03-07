import { useState } from 'react';
import { Message } from './messengerTypes';
import { useMessengerState } from './useMessengerState';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@heroui/react';

// Helper for temporary ID generation
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useSendMessage() {
  const { addMessage, updateMessageStatus, updateMessageId, editMessage } = useMessengerState();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (
    chatId: string,
    content: string,
    options: {
      file?: string;
      replyTo?: string;
      editId?: string;
      expires?: number;
    } = {}
  ): Promise<Message | null> => {
    if (!content.trim() && !options.file) {
      setError('Message cannot be empty');
      return null;
    }

    setSending(true);
    setError(null);

    let tempId: string | null = null;

    if (options.editId) {
      // Optimistically update the existing message
      editMessage(chatId, options.editId, content.trim());
      updateMessageStatus(chatId, options.editId, 'sending');
    } else {
      tempId = generateTempId();
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '0';

      const newMessage: Message = {
        id: tempId,
        chatId,
        senderId: userId || '0',
        senderName: 'You',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sending',
        reply_to: options.replyTo,
        edited: !!options.editId,
        expires: options.expires,
      };

      // Optimistically add the new message
      addMessage(chatId, newMessage);
    }

    try {
      const messageId = await invoke<string>('send_group_message', {
        groupId: chatId,
        text: content.trim(),
        file: options.file || null,
        replyMessageId: options.replyTo || null,
        editMessageId: options.editId || null,
        expires: options.expires || null,
      });

      if (options.editId) {
        updateMessageStatus(chatId, options.editId, 'sent');
      } else if (tempId) {
        updateMessageId(chatId, tempId, messageId);
        updateMessageStatus(chatId, messageId, 'sent');
      }

      setSending(false);
      return { 
        id: messageId, 
        chatId, 
        content: content.trim(), 
        status: 'sent',
        timestamp: new Date().toISOString(),
        isOwn: true
      } as Message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error sending message:', err);
      setError(errorMessage);
      
      if (options.editId) {
        updateMessageStatus(chatId, options.editId, 'error');
      } else if (tempId) {
        updateMessageStatus(chatId, tempId, 'error');
      }
      
      toast(`Failed to send message: ${errorMessage}`, { variant: 'danger' });
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
