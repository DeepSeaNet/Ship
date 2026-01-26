'use client';

import { Button, Avatar, Chip } from '@heroui/react';
import { Chat } from '@/hooks/messengerTypes';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
}

export function ChatListItem({ chat, isActive, onSelect }: ChatListItemProps) {
  const initials = chat.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Button
      fullWidth
      variant={isActive ? 'primary' : 'ghost'}
      className="h-auto p-2 justify-start gap-3 mb-1"
      onPress={onSelect}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar size="md">
            {chat.avatar && <Avatar.Image src={chat.avatar} alt={chat.name} />}
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>
          {chat.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1">
              <Chip size="sm" variant="primary">
                {chat.unreadCount}
              </Chip>
            </div>
          )}
        </div>

        {/* Chat Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-sm truncate">{chat.name}</div>
          <div className="text-xs opacity-70 truncate">{chat.lastMessage}</div>
        </div>

        {/* Time */}
        <div className="text-xs opacity-50 flex-shrink-0">
          {chat.lastMessageTime}
        </div>
      </div>
    </Button>
  );
}
