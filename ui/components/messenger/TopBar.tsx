'use client';

import { Button } from '@heroui/react';
import { Handset, Video, Ellipsis, CircleInfo, Keyboard } from '@gravity-ui/icons';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useChats } from '@/hooks/useChats';
import { useState } from 'react';
import { VoiceCallModal } from '../voice/VoiceCallModal';

interface TopBarProps {
  onInfoClick?: () => void;
}

export function TopBar({ onInfoClick }: TopBarProps) {
  const { uiState } = useMessengerState();
  const { getChatById } = useChats();
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isJoinMode, setIsJoinMode] = useState(false);
  const activeChat = uiState.activeChatId ? getChatById(uiState.activeChatId) : null;

  const handleOpenJoin = () => {
    setIsJoinMode(true);
    setIsVoiceModalOpen(true);
  };

  const handleOpenCall = () => {
    setIsJoinMode(false);
    setIsVoiceModalOpen(true);
  };

  const handleClose = () => {
    setIsVoiceModalOpen(false);
    setIsJoinMode(false);
  };

  return (
    <div className="h-16 border-b border-border flex items-center px-6 justify-between bg-surface">
      {activeChat ? (
        <div className="flex items-center gap-3">
          {activeChat.avatar ? (
            <img src={activeChat.avatar} alt={activeChat.name} className="w-10 h-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-accent-foreground font-bold text-sm border border-neutral-700">
              {activeChat.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm text-accent">{activeChat.name}</h3>
            <p className="text-xs text-muted">
              {activeChat.isGroup
                ? `${activeChat.members?.length || 0} members`
                : 'Online'
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="text-muted text-sm">Select a conversation</div>
      )}

      <div className="flex items-center gap-1">
        <Button isIconOnly variant="ghost" size="sm" onPress={handleOpenJoin} className="hover:bg-on-surface text-muted">
          <Keyboard className="w-5 h-5" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" onPress={handleOpenCall} className="hover:bg-on-surface text-muted">
          <Handset className="w-5 h-5" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" className="hover:bg-on-surface text-muted">
          <Video className="w-5 h-5" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" onPress={onInfoClick} className="hover:bg-on-surface text-muted">
          <CircleInfo className="w-5 h-5" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" className="hover:bg-on-surface text-muted">
          <Ellipsis className="w-5 h-5" />
        </Button>
      </div>

      {isVoiceModalOpen && (
        <VoiceCallModal
          isOpen={isVoiceModalOpen}
          onClose={handleClose}
          chatName={!isJoinMode && activeChat ? activeChat.name : undefined}
          chatAvatar={!isJoinMode && activeChat ? activeChat.avatar : undefined}
        />
      )}
    </div>
  );
}