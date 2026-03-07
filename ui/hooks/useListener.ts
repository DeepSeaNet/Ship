'use client';

import React, { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from '@heroui/react';
import { Message, User, Chat, Group, UIState } from './messengerTypes';
import { getNotificationSettings } from './useNotificationSettings';

// Helper for media URLs (duplicate here or import if exported)
const createMediaUrl = (avatarData: string | undefined): string | undefined => {
  if (!avatarData) return undefined;
  if (avatarData.startsWith('data:') || avatarData.startsWith('http')) return avatarData;
  return `data:image/png;base64,${avatarData}`;
};

interface ListenerProps {
  currentUser: User | null;
  uiStateRef: React.MutableRefObject<UIState>;
  chatsRef: React.MutableRefObject<Chat[]>;
  usersRef: React.MutableRefObject<Record<string, User>>;
  actions: {
    addMessage: (chatId: string, message: Message) => void;
    setActiveChatId: (id: string | null) => void;
    fetchChats: () => Promise<void>;
    fetchContacts: () => Promise<void>;
    setIsLoading: (loading: boolean) => void;
    setCurrentUser: (user: User | null) => void;
    setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    setUIState: React.Dispatch<React.SetStateAction<UIState>>;
    editMessage: (chatId: string, messageId: string, newContent: string) => void;
    updateMessageStatus: (chatId: string, messageId: string, status: Message['status']) => void;
    updateMessageId: (chatId: string, oldId: string, newId: string) => void;
    upsertUser: (user: User) => void;
  };
}

export function useListener({ currentUser, uiStateRef, chatsRef, usersRef, actions }: ListenerProps) {
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupListener = async () => {
      // Initial Data Loading
      actions.setIsLoading(true);
      await Promise.all([
        actions.fetchChats(),
        actions.fetchContacts()
      ]);
      
      if (!isMounted) return;
      actions.setIsLoading(false);

      // Current User Initialization
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      if (userId && username && isMounted) {
        actions.setCurrentUser({ id: userId, name: username, status: 'Online' });
        actions.upsertUser({ id: userId, name: username, status: 'Online' });
      }

      // Cleanup existing listener
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      // Setup Tauri Event Listener
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
            
            // Use refs to avoid stale closures
            const chats = chatsRef.current;
            const users = usersRef.current;
            
            const chat = chats.find(c => c.id === chatId);
            const senderId = data.sender_id?.toString() || '0';
            const sender = users[senderId];
            const senderName = data.sender_name || sender?.name || 'User ' + senderId;

            const message: Message = {
              id: data.message_id.toString(),
              chatId: chatId,
              senderId,
              senderName,
              content: data.text,
              timestamp: new Date(data.timestamp * 1000).toISOString(),
              isOwn: data.sender_id === currentUser?.id || data.sender_id?.toString() === currentUser?.id,
              status: 'sent',
              media: data.media,
              media_name: data.media_name,
              reply_to: (data.reply_message_id || data.reply_to)?.toString(),
              edited: !!data.edit_date,
              expires: data.expires,
              is_file: data.is_file,
            };

            if (data.is_edit || data.is_edit === 'true') {
              actions.editMessage(chatId, data.message_id.toString(), data.text);
            } else {
              actions.addMessage(chatId, message);
            }

            const currentUI = uiStateRef.current;
            const isCurrentlyActive = currentUI.activeChatId === chatId || currentUI.activeGroupId === chatId;

            if (!isCurrentlyActive && !message.isOwn) {
              const notifSettings = getNotificationSettings();
              const override = notifSettings.chatOverrides[chatId];
              
              const isGroup = !!data.group_id;
              
              // Per-chat mute
              if (override?.muted) return;
              
              // Determine mention filter: use override if present, else global
              const useMentionsOnly = override?.mentionsOnly ?? notifSettings.mentionsOnly;
              
              const mentionTriggered = !useMentionsOnly ||
                message.content.includes('@' + (localStorage.getItem('username') || ''));

              const shouldShow =
                !notifSettings.doNotDisturb &&
                notifSettings.enableToasts &&
                (isGroup ? notifSettings.groupMessages : notifSettings.directMessages) &&
                mentionTriggered;

              // Always show toast when the local user is @mentioned (overrides mentionsOnly)
              const username = localStorage.getItem('username') || '';
              const isMentioned = username && message.content.includes('@' + username);

              if (shouldShow || isMentioned) {
                toast(`From ${senderName || senderId}`, {
                  description: `In "${chat?.name || 'Unknown'}": ${message.content}`,
                  variant: "accent",
                  actionProps: {
                    children: "Open",
                    onPress: () => {
                      actions.setActiveChatId(chatId);
                    },
                  },
                });
              }
            }
            break;
          }

          case 'leave_group':
          case 'join_group':
          case 'create_group':
            actions.fetchChats();
            if (payload.type === 'leave_group') {
              const leftGroupId = payload.data.group_id;
              actions.setUIState(prev => {
                if (prev.activeChatId === leftGroupId || prev.activeGroupId === leftGroupId) {
                  return { ...prev, activeChatId: null, activeGroupId: null };
                }
                return prev;
              });
            }
            break;

          case 'message_edited':
          case 'edit_message': {
            const d = payload.data;
            const chatId = d.group_id || d.chat_id;
            if (chatId && d.message_id && d.text != null) {
              actions.editMessage(chatId, String(d.message_id), d.text);
            }
            break;
          }

          case 'group_config_updated': {
            const groupData = payload.data;
            const groupId = groupData.group_id;

            actions.setGroups(prevGroups => prevGroups.map(g => {
              if (String(g.id) === String(groupId)) {
                return {
                  ...g,
                  name: groupData.group_name ?? g.name,
                  description: groupData.description ?? g.description,
                  avatar: createMediaUrl(groupData.avatar) ?? g.avatar,
                  owner_id: groupData.owner_id ?? g.owner_id,
                  admins: groupData.admins ?? g.admins,
                  members: groupData.members ?? g.members,
                  group_config: { ...g.group_config, ...groupData } as any,
                  user_permissions: groupData.user_permissions ?? g.user_permissions,
                  users_permissions: groupData.users_permisions ?? g.users_permissions,
                  default_permissions: groupData.default_permissions ?? g.default_permissions,
                };
              }
              return g;
            }));

            actions.setChats(prevChats => prevChats.map(c => {
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
                  group_config: { ...c.group_config, ...groupData } as any,
                };
              }
              return c;
            }));
            break;
          }
          case 'user_status_changed': {
            const data = payload.data;
            if (data.user_id) {
              actions.upsertUser({
                id: String(data.user_id),
                name: usersRef.current[String(data.user_id)]?.name || 'User ' + data.user_id,
                status: data.status,
              });
            }
            break;
          }

          case 'message_delivery': {
            const { message_id, success } = payload.data;
            // Iterate over all chats to find and update the message status
            // This is a bit expensive but necessary since payload doesn't have chatId
             uiStateRef.current.loadedChatIds.forEach(chatId => {
               actions.updateMessageStatus(chatId, message_id.toString(), success ? 'sent' : 'error');
             });
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
  }, [actions.fetchChats, currentUser?.id]);
}
