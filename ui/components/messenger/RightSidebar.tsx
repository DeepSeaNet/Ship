'use client';

import { useState } from 'react';
import { ScrollShadow, Avatar } from '@heroui/react';
import { Picture, MusicNote, Video, FileText, PersonPlus, ChevronDown, ChevronRight, Xmark, Gear } from '@gravity-ui/icons';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useGroupInfo } from '@/hooks/useGroupInfo';
import { useChats } from '@/hooks/useChats';
import { GroupSettingsModal } from '../settings/GroupSettingsModal';

interface RightSidebarProps {
  onClose?: () => void;
  onToggle?: () => void;
}

export function RightSidebar({ onClose, onToggle }: RightSidebarProps) {
  const { uiState } = useMessengerState();
  const { getChatById } = useChats();
  const { groupInfo, loading } = useGroupInfo(uiState.activeChatId);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeChat = uiState.activeChatId ? getChatById(uiState.activeChatId) : null;

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    photos: false,
    audio: false,
    videos: false,
    documents: false,
    members: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!uiState.activeChatId) {
    return (
      <div className="w-96 bg-surface border-l border-border flex items-center justify-center">
        <p className="text-sm text-muted">Select a chat to view info</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-96 bg-surface border-l border-border flex items-center justify-center">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className="w-96 bg-surface border-l border-border flex items-center justify-center">
        <p className="text-sm text-muted">No group info available</p>
      </div>
    );
  }

  const photosCount = groupInfo.photos.length;
  const audioCount = groupInfo.audio.length;
  const videosCount = groupInfo.videos.length;
  const documentsCount = groupInfo.documents.length;
  const membersCount = groupInfo.members.length;

  return (
    <div className="w-96 bg-surface flex flex-col h-full border-l border-border">
      <ScrollShadow className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header with Close and Expand Buttons */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xl text-accent-surface">Info</h3>
            <div className="flex gap-1">
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
                title="Toggle Sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
                title="Settings"
                disabled={!activeChat?.isGroup}
              >
                <Gear className="w-5 h-5" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
                  title="Close"
                >
                  <Xmark className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Group Profile Section */}
          <div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-border">
            <Avatar size="lg" className="w-24 h-24 text-4xl shadow-lg border-4 border-surface">
              {groupInfo.avatar && <Avatar.Image src={groupInfo.avatar} alt={groupInfo.name} />}
              <Avatar.Fallback className="bg-gradient-to-br from-accent to-accent-surface text-white">
                {groupInfo.name.slice(0, 1).toUpperCase()}
              </Avatar.Fallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-accent-surface">{groupInfo.name}</h2>
              <p className="text-sm text-muted line-clamp-3">{groupInfo.description || 'No description provided'}</p>
            </div>
            <div className="flex w-full gap-2">
              <button className="flex-1 px-3 py-2 bg-on-surface rounded-xl text-sm font-medium hover:bg-neutral-800 transition">
                Share Link
              </button>
              <button className="flex-1 px-3 py-2 bg-on-surface rounded-xl text-sm font-medium hover:bg-neutral-800 transition">
                Search
              </button>
            </div>
          </div>

          {/* Photos Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Picture className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-accent-surface">Photos</span>
                <span className="text-sm text-muted">• {photosCount}</span>
              </div>
              <button
                onClick={() => toggleSection('photos')}
                className="text-muted hover:text-accent-foreground transition"
              >
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${expandedSections.photos ? 'rotate-180' : ''
                    }`}
                />
              </button>
            </div>
            {expandedSections.photos && (
              photosCount > 0 ? (
                <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-200">
                  {groupInfo.photos.slice(0, 8).map((photo) => (
                    <div
                      key={photo.id}
                      title={photo.name}
                      className="aspect-square bg-neutral-800 rounded-xl hover:opacity-80 cursor-pointer border border-neutral-700 flex items-center justify-center overflow-hidden"
                    >
                      {/* We'd call get_group_media(photo.id) here if we wanted to show thumbnails */}
                      <Picture className="w-4 h-4 text-neutral-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted px-8">No photos yet</p>
              )
            )}
          </div>

          {/* Audio Section */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <MusicNote className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-accent-surface">Audio</span>
                <span className="text-sm text-muted">• {audioCount}</span>
              </div>
              <button
                onClick={() => toggleSection('audio')}
                className="text-muted hover:text-accent-foreground transition"
              >
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${expandedSections.audio ? 'rotate-180' : ''
                    }`}
                />
              </button>
            </div>
            {expandedSections.audio && (
              audioCount > 0 ? (
                <div className="space-y-2 animate-in fade-in duration-200">
                  {groupInfo.audio.slice(0, 3).map(a => (
                    <div key={a.id} className="text-xs text-accent-surface truncate px-2 py-1 bg-on-surface rounded">{a.name}</div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted px-8">No audio files</p>
              )
            )}
          </div>

          {/* Videos Section */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-accent-surface">Videos</span>
                <span className="text-sm text-muted">• {videosCount}</span>
              </div>
              <button
                onClick={() => toggleSection('videos')}
                className="text-muted hover:text-accent-foreground transition"
              >
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${expandedSections.videos ? 'rotate-180' : ''
                    }`}
                />
              </button>
            </div>
            {expandedSections.videos && (
              videosCount > 0 ? (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                  {groupInfo.videos.slice(0, 2).map(v => (
                    <div key={v.id} className="aspect-video bg-neutral-800 rounded-lg flex items-center justify-center">
                      <Video className="w-6 h-6 text-neutral-600" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted px-8">No videos yet</p>
              )
            )}
          </div>

          {/* Documents Section */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-accent-surface">Documents</span>
                <span className="text-sm text-muted">• {documentsCount}</span>
              </div>
              <button
                onClick={() => toggleSection('documents')}
                className="text-muted hover:text-accent-foreground transition"
              >
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${expandedSections.documents ? 'rotate-180' : ''
                    }`}
                />
              </button>
            </div>
            {expandedSections.documents && (
              documentsCount > 0 ? (
                <div className="space-y-2 animate-in fade-in duration-200">
                  {groupInfo.documents.slice(0, 5).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded hover:bg-on-surface">
                      <FileText className="w-4 h-4 text-muted" />
                      <span className="text-xs text-accent-surface truncate">{doc.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted px-8">No documents yet</p>
              )
            )}
          </div>

          {/* Members Section */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PersonPlus className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-accent-surface">Members ({membersCount})</span>
              </div>
              <button
                onClick={() => toggleSection('members')}
                className="text-muted hover:text-accent-foreground transition"
              >
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-200 ${expandedSections.members ? 'rotate-180' : ''
                    }`}
                />
              </button>
            </div>
            {expandedSections.members && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {groupInfo.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3"
                  >
                    <div className="relative">
                      <Avatar size="md">
                        {member.avatar && <Avatar.Image src={member.avatar} alt={member.name} />}
                        <Avatar.Fallback>{member.name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
                      </Avatar>
                      {member.role === 'owner' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-surface z-10" title="Owner" />}
                      {member.role === 'admin' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-surface z-10" title="Admin" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-accent-surface truncate">{member.name}</p>
                      <p className="text-xs text-muted truncate">{member.role?.toUpperCase() || 'MEMBER'}</p>
                    </div>
                  </div>
                ))}

                {membersCount > 5 && (
                  <button className="text-sm text-primary hover:underline transition font-medium">
                    View All {membersCount} Members
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollShadow>

      {activeChat && activeChat.isGroup && (
        <GroupSettingsModal
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          group={activeChat}
        />
      )}
    </div>
  );
}
