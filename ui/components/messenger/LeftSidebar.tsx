'use client';

import { Card, ScrollShadow, Button, Spinner } from '@heroui/react';
import { Plus, Magnifier, Xmark } from '@gravity-ui/icons';
import { useChats } from '@/hooks/useChats';
import { useMessengerState } from '@/hooks/useMessengerState';
import { Chat } from '@/hooks/messengerTypes';
import { ChatListItem } from './ChatListItem';
import { CreateGroupModal } from './CreateGroupModal';
import { useState } from 'react';

interface LeftSidebarProps {
  onClose?: () => void;
}

export function LeftSidebar({ onClose }: LeftSidebarProps) {
  const { chats, loading } = useChats();
  const { uiState, setActiveChatId } = useMessengerState();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const handleStartNewChat = () => {
    setIsCreateGroupOpen(true);
  };

  return (
    <div className="w-full h-full bg-surface flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-accent-surface">Messages</h2>
          <div className="flex gap-1">
            <Button isIconOnly variant="ghost" size="sm" onPress={handleStartNewChat} className="hover:bg-on-surface text-muted">
              <Plus className="w-5 h-5" />
            </Button>
            {onClose && (
              <Button isIconOnly variant="ghost" size="sm" onPress={onClose} className="hover:bg-on-surface text-muted">
                <Xmark className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        {/* Search Input */}
        <div className="relative">
          <Magnifier className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search message"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-on-surface border border-border text-sm text-accent-surface placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-700"
          />
        </div>
      </div>

      {/* Avatar Status Row */}
      {/*
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-accent-foreground font-bold text-sm border border-neutral-700">
                {String.fromCharCode(64 + i)}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-neutral-600 border-2 border-neutral-950"></div>
            </div>
          ))}
        </div>
      </div>
      */}
      {/* Pinned Section */}
      <div>
        <p className="text-xs font-semibold text-muted mb-2 px-2">PINNED</p>
      </div>

      {/* Chat List */}
      <ScrollShadow className="flex-1 overflow-y-auto -mx-4 px-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="sm" color="current" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-sm text-muted">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map((chat: Chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={uiState.activeChatId === chat.id}
                onSelect={() => setActiveChatId(chat.id)}
              />
            ))}
          </div>
        )}
      </ScrollShadow>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onOpenChange={setIsCreateGroupOpen}
      />
    </div>
  );
}