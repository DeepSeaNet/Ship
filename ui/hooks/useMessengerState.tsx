'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from '@heroui/react';
import { UIState, MessengerContextType, Message, User, Chat, Group } from './messengerTypes';

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
        lastMessageTime: formatChatTime(group.last_message?.timestamp
          ? new Date(group.last_message.timestamp * 1000).toISOString()
          : group.date ? new Date(group.date * 1000).toISOString() : undefined),
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
        lastMessageTime: chat.last_message?.timestamp,
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

  // --- Event Listener ---
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupListener = async () => {
      // Initial Fetch
      setIsLoading(true);
      await Promise.all([
        fetchChats(),
        fetchContacts()
      ]);
      if (!isMounted) return;
      setIsLoading(false);

      // Fetch current user
      const userId = localStorage.getItem('userId');
      if (userId && isMounted) {
        setCurrentUser({ id: userId, name: 'You' });
      }

      // Cleanup existing listener before creating a new one
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      const unlisten = await listen<any>('server-event', (event) => {
        if (!isMounted) return;

        const payload = event.payload;
        console.log('Received server event:', payload);

        if (!payload || !payload.type) return;

        switch (payload.type) {
          case 'new_group_message':
          case 'new_message': {
            const data = payload.data;
            const chatId = data.group_id || data.chat_id;
            const chat = chats.find(chat => chat.id === chatId);
            const senderId = data.sender_id?.toString() || '0';
            const sender = users[senderId];

            // If sender name is missing, we'll need to fetch it (handled below)
            const senderName = data.sender_name || sender?.name || 'User ' + senderId;
            const message: Message = {
              id: data.message_id,
              chatId: chatId,
              senderId,
              senderName,
              content: data.text,
              timestamp: formatChatTime(new Date(data.timestamp * 1000).toISOString()),
              isOwn: data.sender_id === currentUser?.id,
              status: 'sent',
              media: data.media,
              media_name: data.media_name,
              reply_to: data.reply_to,
              edited: !!data.edit_date,
              expires: data.expires,
              is_file: data.is_file,
            };
            addMessage(chatId, message);
            const currentUI = uiStateRef.current;
            const isCurrentlyActive = currentUI.activeChatId === chatId || currentUI.activeGroupId === chatId;

            if (!isCurrentlyActive && !message.isOwn) {
              toast(`From ${senderName || senderId}`, {
                description: `In "${chat?.name || 'Unknown'}": ${message.content}`,
                variant: "accent",
                actionProps: {
                  children: "Open",
                  onPress: () => {
                    console.log('Toast Open button clicked for chatId:', chatId);
                    setActiveChatId(chatId);
                  },
                },
              });
            }
            break;
          }
          case 'leave_group':
          case 'join_group':
          case 'create_group':
            fetchChats();
            if (payload.type === 'leave_group') {
              const leftGroupId = payload.data.group_id;
              setUIState(prev => {
                if (prev.activeChatId === leftGroupId || prev.activeGroupId === leftGroupId) {
                  return { ...prev, activeChatId: null, activeGroupId: null };
                }
                return prev;
              });
            }
            break;
          case 'group_config_updated': {
            const groupData = payload.data;
            const groupId = groupData.group_id;

            setGroups(prevGroups => prevGroups.map(g => {
              if (String(g.id) === String(groupId)) {
                return {
                  ...g,
                  name: groupData.group_name ?? g.name,
                  description: groupData.description ?? g.description,
                  avatar: createMediaUrl(groupData.avatar) ?? g.avatar,
                  owner_id: groupData.owner_id ?? g.owner_id,
                  admins: groupData.admins ?? g.admins,
                  members: groupData.members ?? g.members,
                  group_config: {
                    ...g.group_config,
                    ...groupData,
                  } as any,
                  user_permissions: groupData.user_permissions ?? g.user_permissions,
                  users_permissions: groupData.users_permisions ?? g.users_permissions,
                  default_permissions: groupData.default_permissions ?? g.default_permissions,
                };
              }
              return g;
            }));

            setChats(prevChats => prevChats.map(c => {
              if (c.isGroup && String(c.id) === String(groupId)) {
                return {
                  ...c,
                  name: groupData.group_name ?? c.name,
                  description: groupData.description ?? c.description,
                  avatar: createMediaUrl(groupData.avatar) ?? c.avatar,
                  members: groupData.members ?? c.members,
                  owner_id: groupData.owner_id ?? c.owner_id,
                  admins: groupData.admins ?? c.admins,
                  user_permissions: groupData.user_permissions ?? c.user_permissions,
                  users_permissions: groupData.users_permisions ?? c.users_permissions,
                  default_permissions: groupData.default_permissions ?? c.default_permissions,
                  group_config: {
                    ...c.group_config,
                    ...groupData,
                  } as any,
                };
              }
              return c;
            }));
            break;
          }
          default:
            console.log('Unhandled event type:', payload.type);
        }
      });

      if (!isMounted) {
        unlisten();
      } else {
        unlistenRef.current = unlisten;
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [fetchChats, currentUser?.id]);
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
