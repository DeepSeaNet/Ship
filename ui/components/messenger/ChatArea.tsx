import { useRef, useEffect } from 'react';
import { ScrollShadow, Spinner, Avatar } from '@heroui/react';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useChats } from '@/hooks/useChats';
import { useMessages } from '@/hooks/useMessages';
import { MessageItem } from './MessageItem';

export function ChatArea() {
  const { uiState } = useMessengerState();
  const { getChatById } = useChats();
  const { messages, loading, loadMore, hasMore } = useMessages(uiState.activeChatId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef<boolean>(true);

  const activeChat = uiState.activeChatId ? getChatById(uiState.activeChatId) : null;

  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;

    const scrollContainer = scrollRef.current;

    if (isInitialLoad.current) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'instant',
      });
      isInitialLoad.current = false;
    } else if (lastScrollHeight.current > 0) {
      // Maintain scroll position after loading more
      const heightDiff = scrollContainer.scrollHeight - lastScrollHeight.current;
      scrollContainer.scrollTop = heightDiff;
      lastScrollHeight.current = 0;
    } else {
      // Scroll to bottom on new messages
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;
      if (isNearBottom) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !loading) {
      lastScrollHeight.current = target.scrollHeight;
      loadMore();
    }
  };

  useEffect(() => {
    isInitialLoad.current = true;
  }, [uiState.activeChatId]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="text-2xl font-light text-muted mb-2">
            Select a conversation to start messaging
          </div>
          <p className="text-sm text-neutral-600">
            Choose a chat from the list or start a new conversation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <ScrollShadow
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="sm" color="current" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <p className="text-sm text-muted">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-1 flex flex-col">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}
