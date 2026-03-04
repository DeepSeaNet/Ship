'use client';

import { useEffect, useState } from 'react';
import { useMessengerState, MessengerProvider } from '@/hooks/useMessengerState';
import { TopBar } from './TopBar';
import { LeftSidebar } from './LeftSidebar';
import { ChatArea } from './ChatArea';
import { InputBar } from './InputBar';
import { RightSidebar } from './RightSidebar';
import { SettingsModal } from './SettingsModal';
import { SquareFill, Persons, Comment, Gear } from '@gravity-ui/icons';
import './messenger.css';

function MessengerContent() {
  const { setAnimatingIn } = useMessengerState();
  const [showMessages, setShowMessages] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setAnimatingIn(true);
    const timer = setTimeout(() => setAnimatingIn(false), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="flex h-screen bg-background overflow-hidden gap-4 p-4">
      {/* Navigation Sidebar - Minimal icons only */}
      <div className="w-16 rounded-2xl border border-border flex flex-col items-center py-4 gap-4">
        <button className="w-12 h-12 rounded-xl bg-on-surface text-accent flex items-center justify-center font-bold hover:bg-on-surface-hover transition">M</button>
        <div className="flex flex-col gap-3 mt-2">
          <button className="w-10 h-10 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted">
            <SquareFill className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted">
            <Persons className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowMessages(!showMessages)}
            className="w-10 h-10 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
          >
            <Comment className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1"></div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-lg hover:bg-on-surface flex items-center justify-center transition text-muted"
        >
          <Gear className="w-5 h-5" />
        </button>
      </div>

      {/* Left Panel - Messages List (Closable with Animation) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${showMessages ? 'w-64 opacity-100' : 'w-0 opacity-0'
          }`}
      >
        <div className="w-64 bg-background rounded-2xl flex flex-col overflow-hidden h-full">
          <LeftSidebar onClose={() => setShowMessages(false)} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-background rounded-2xl flex flex-col overflow-hidden">
        <TopBar onInfoClick={() => setShowGroupInfo(!showGroupInfo)} />
        <ChatArea />
        <InputBar />
      </div>

      {/* Right Panel - Group Info Sidebar (Wider with Animation) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${showGroupInfo ? 'w-96 opacity-100' : 'w-0 opacity-0'
          }`}
      >
        <div className="w-96 bg-background rounded-2xl border border-border flex flex-col overflow-hidden h-full">
          <RightSidebar onClose={() => setShowGroupInfo(false)} onToggle={() => setShowGroupInfo(!showGroupInfo)} />
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

export function MainMenu() {
  return (
    <MessengerProvider>
      <MessengerContent />
    </MessengerProvider>
  );
}

export default MainMenu;
