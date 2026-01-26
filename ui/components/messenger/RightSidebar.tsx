'use client';

import { useState } from 'react';
import { ScrollShadow } from '@heroui/react';
import { Picture, MusicNote, Video, FileText, PersonPlus, ChevronDown, ChevronRight, Xmark, Gear } from '@gravity-ui/icons';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useGroupInfo } from '@/hooks/useGroupInfo';

interface RightSidebarProps {
  onClose?: () => void;
  onToggle?: () => void;
}

export function RightSidebar({ onClose, onToggle }: RightSidebarProps) {
  const { uiState } = useMessengerState();
  const { groupInfo, loading } = useGroupInfo(uiState.activeChatId);

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    photos: true,
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
    <div className="w-96 bg-surface flex flex-col h-full">
      <ScrollShadow className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header with Close and Expand Buttons */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <h3 className="font-semibold text-xl text-accent-surface">Group Info</h3>
            <div className="flex gap-1">
              <button
                onClick={onToggle}
                className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
              >
                <Gear className="w-5 h-5" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
                >
                  <Xmark className="w-5 h-5" />
                </button>
              )}
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
            {expandedSections.photos && photosCount > 0 && (
              <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-200">
                {groupInfo.photos.slice(0, 4).map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl hover:opacity-80 cursor-pointer border border-neutral-700"
                  />
                ))}
              </div>
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
            {expandedSections.audio && audioCount > 0 && (
              <div className="pb-3 animate-in fade-in duration-200">
                <p className="text-sm text-muted">Audio files will be displayed here</p>
              </div>
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
            {expandedSections.videos && videosCount > 0 && (
              <div className="pb-3 animate-in fade-in duration-200">
                <p className="text-sm text-muted">Video files will be displayed here</p>
              </div>
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
            {expandedSections.documents && documentsCount > 0 && (
              <div className="pb-3 animate-in fade-in duration-200">
                <p className="text-sm text-muted">Document files will be displayed here</p>
              </div>
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
                {groupInfo.members.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-accent-foreground text-sm font-bold border border-neutral-700">
                      {member.name.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-accent-surface">{member.name}</p>
                      <p className="text-xs text-muted">{member.email}</p>
                    </div>
                  </div>
                ))}

                {/* View All Button */}
                <button className="text-sm text-muted hover:text-accent-foreground transition font-medium">
                  View All
                </button>

                {/* Scroll Down Button */}
                <button className="w-full py-3 flex items-center justify-center gap-2 text-sm text-muted hover:text-accent-foreground transition">
                  <span>Scroll Down</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </ScrollShadow>
    </div>
  );
}
