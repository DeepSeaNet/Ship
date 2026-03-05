'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from '@heroui/react';
import { UIState, MessengerContextType, Message, User, Chat, Group } from './messengerTypes';
import { useListener } from './useListener';

// --- Helper Functions ---

// Helper for media URLs
const createMediaUrl = (avatarData: string | undefined): string | undefined => {
  if (!avatarData) return undefined;
  if (avatarData.startsWith('data:') || avatarData.startsWith('http')) return avatarData;
  return `data:image/png;base64,${avatarData}`;
};

export const formatChatTime = (isoString?: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString; // Return original string if invalid date

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (diff < dayMs && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < dayMs * 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

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
  // --- State ---
  const [uiState, setUIState] = useState<UIState>(defaultUIState);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [users, setUsers] = useState<Record<string, User>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const uiStateRef = useRef(uiState);
  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  const chatsRef = useRef<Chat[]>(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const usersRef = useRef<Record<string, User>>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // --- Fetchers ---

  const fetchChats = useCallback(async () => {
    try {
      // Fetch groups
      const loadedGroups = await invoke<any[]>('get_groups');
      const formattedGroups: Group[] = loadedGroups.map((group: any) => ({
        id: group.group_id,
        name: group.group_name,
        avatar: createMediaUrl(group.avatar),
        unreadCount: 0,
        isGroup: true,
        participants: group.members,
        description: group.description,
        owner_id: group.owner_id,
        admins: group.admins,
        members: group.members,
        group_config: group.group_config || null,
        user_permissions: group.user_permissions,
        users_permissions: group.users_permisions,
        default_permissions: group.default_permissions,
        lastMessage: group.last_message?.text || group.last_message?.content || '',
        lastMessageTime: group.last_message?.timestamp
          ? new Date(group.last_message.timestamp * 1000).toISOString()
          : group.date ? new Date(group.date * 1000).toISOString() : undefined,
        loaded: false,
      }));

      setGroups(formattedGroups);

      // Fetch private chats (placeholder for now as per previous implementation)
      const privateChats = await invoke<any[]>('get_chats');
      const formattedPrivateChats: Chat[] = privateChats.map((chat: any) => ({
        id: chat.id,
        name: chat.name,
        avatar: chat.avatar,
        unreadCount: chat.unread_count || 0,
        isGroup: false,
        lastMessage: chat.last_message?.text,
        lastMessageTime: chat.last_message?.timestamp ? new Date(chat.last_message.timestamp * 1000).toISOString() : undefined,
      }));

      // Combine and sort
      const allChats = [...formattedGroups, ...formattedPrivateChats].sort((a, b) => {
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });

      setChats(allChats);
    } catch (error) {
      console.error("Error fetching chats/groups:", error);
      toast("Failed to load chats", { variant: "danger" });
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    // Re-use fetchChats logic since it loads groups as well,
    // or duplicate strictly group loading logic if needed separately.
    // For now, fetchChats updates both 'groups' and 'chats' state.
    await fetchChats();
  }, [fetchChats]);

  const fetchContacts = useCallback(async () => {
    try {
      const result = await invoke<any[]>('get_contacts');
      setContacts(result);

      // Also potentially upsert these as 'users' for fast lookup
      result.forEach(c => {
        upsertUser({
          id: String(c.user_id),
          name: c.username,
          avatar: createMediaUrl(c.avatar),
          status: c.status
        });
      });
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  }, []);

  // --- Actions ---

  const setActiveChatId = (id: string | null) => {
    const isGroup = chatsRef.current.find(c => c.id === id)?.isGroup || false;
    console.log('Setting active chat to:', id, 'isGroup:', isGroup);
    setUIState((prev) => ({
      ...prev,
      activeChatId: id,
      activeGroupId: isGroup ? id : null,
    }));
  };

  const setActiveGroupId = (id: string | null) => {
    setActiveChatId(id);
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

    // Update last message in chat list
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          lastMessage: message.content,
          lastMessageTime: message.timestamp || new Date().toISOString() // Fallback if timestamp missing
        };
      }
      return chat;
    }).sort((a, b) => {
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bTime - aTime;
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

  const updateMessageId = (chatId: string, oldId: string, newId: string) => {
    setMessagesByChat((prev) => {
      const chatMessages = prev[chatId];
      if (!chatMessages) return prev;

      return {
        ...prev,
        [chatId]: chatMessages.map((msg) =>
          msg.id === oldId ? { ...msg, id: newId } : msg
        ),
      };
    });
  };

  const editMessage = (chatId: string, messageId: string, newContent: string) => {
    setMessagesByChat((prev) => {
      const chatMessages = prev[chatId];
      if (!chatMessages) return prev;
      return {
        ...prev,
        [chatId]: chatMessages.map((msg) =>
          msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
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

    // Also update contact status if exists
    setContacts((prev) =>
      prev.map((c) =>
        String(c.user_id) === user.id
          ? { ...c, status: user.status || c.status }
          : c
      )
    );
  };

  // --- Event Listener ---
  useListener({
    currentUser,
    uiStateRef,
    chatsRef,
    usersRef,
    actions: {
      addMessage,
      setActiveChatId,
      fetchChats,
      fetchContacts,
      setIsLoading,
      setCurrentUser,
      setGroups,
      setChats,
      setUIState,
      editMessage,
      updateMessageStatus,
      updateMessageId,
      upsertUser,
    }
  });
  // Re-run if methods change, though useCallback handles stability

  const value: MessengerContextType = {
    uiState,
    messagesByChat,
    users,
    chats,
    groups,
    isLoading,
    currentUser,
    setActiveChatId,
    setActiveGroupId,
    toggleRightSidebar,
    setAnimatingIn,
    addMessage,
    setMessagesForChat,
    updateMessageStatus,
    updateMessageId,
    editMessage,
    markChatAsLoaded,
    upsertUser,
    fetchChats,
    fetchGroups,
    fetchContacts,
    contacts
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
