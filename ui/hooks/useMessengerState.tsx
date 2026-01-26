'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UIState, MessengerContextType, Message, User } from './messengerTypes';
import { MOCK_MESSAGES_BY_CHAT } from './mock_data';

const defaultUIState: UIState = {
  activeChatId: null,
  activeGroupId: null,
  rightSidebarOpen: false,
  isAnimatingIn: false,
  loadedChatIds: [],
};

const MessengerContext = createContext<MessengerContextType | undefined>(undefined);

interface MessengerProviderProps {
  children: ReactNode;
}

export function MessengerProvider({ children }: MessengerProviderProps) {
  const [uiState, setUIState] = useState<UIState>(defaultUIState);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>(MOCK_MESSAGES_BY_CHAT);
  const [users, setUsers] = useState<Record<string, User>>({});

  const setActiveChatId = (id: string) => {
    setUIState((prev) => ({
      ...prev,
      activeChatId: id,
      activeGroupId: null,
    }));
  };

  const setActiveGroupId = (id: string | null) => {
    setUIState((prev) => ({
      ...prev,
      activeGroupId: id,
      activeChatId: null,
    }));
  };

  const toggleRightSidebar = () => {
    setUIState((prev) => ({
      ...prev,
      rightSidebarOpen: !prev.rightSidebarOpen,
    }));
  };

  const setAnimatingIn = (animating: boolean) => {
    setUIState((prev) => ({
      ...prev,
      isAnimatingIn: animating,
    }));
  };

  const addMessage = (chatId: string, message: Message) => {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), message],
    }));
  };

  const setMessagesForChat = (chatId: string, messages: Message[]) => {
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: messages,
    }));
  };

  const updateMessageStatus = (chatId: string, messageId: string, status: Message['status']) => {
    setMessagesByChat((prev) => {
      const chatMessages = prev[chatId];
      if (!chatMessages) return prev;

      return {
        ...prev,
        [chatId]: chatMessages.map((msg) =>
          msg.id === messageId ? { ...msg, status } : msg
        ),
      };
    });
  };

  const markChatAsLoaded = (chatId: string) => {
    setUIState((prev) => {
      if (prev.loadedChatIds.includes(chatId)) return prev;
      return {
        ...prev,
        loadedChatIds: [...prev.loadedChatIds, chatId],
      };
    });
  };

  const upsertUser = (user: User) => {
    setUsers((prev) => ({
      ...prev,
      [user.id]: { ...(prev[user.id] || {}), ...user },
    }));
  };

  const value: MessengerContextType = {
    uiState,
    messagesByChat,
    users,
    setActiveChatId,
    setActiveGroupId,
    toggleRightSidebar,
    setAnimatingIn,
    addMessage,
    setMessagesForChat,
    updateMessageStatus,
    markChatAsLoaded,
    upsertUser,
  };

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessengerState() {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error(
      'useMessengerState must be used within MessengerProvider'
    );
  }
  return context;
}
