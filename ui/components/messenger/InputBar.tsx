'use client';
import { useState } from 'react';
import { Button, TextField, InputGroup, Spinner } from '@heroui/react';
import { Plus, FaceSmile, Microphone, PaperPlane } from '@gravity-ui/icons';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useSendMessage } from '@/hooks/useSendMessage';

export function InputBar() {
  const { uiState } = useMessengerState();
  const { sendMessage, sending } = useSendMessage();
  const [messageContent, setMessageContent] = useState('');

  const handleSend = () => {
    if (!uiState.activeChatId || !messageContent.trim() || sending) return;
    const contentToSend = messageContent;
    setMessageContent('');
    sendMessage(uiState.activeChatId, contentToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-[80px] flex items-center px-4 gap-3 py-4 bg-background">
      {/* Plus Button */}
      <Button
        isIconOnly
        aria-label="Add attachment"
        size="lg"
        variant="ghost"
        isDisabled={!uiState.activeChatId}
        className="flex-shrink-0 rounded-2xl bg-on-surface hover:bg-on-surface-hover text-muted"
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* TextField with InputGroup */}
      <TextField
        fullWidth
        aria-label="Message input"
        name="message"
        className="flex-1"
      >
        <InputGroup
          fullWidth
          className="rounded-2xl bg-surface border border-field-border focus-within:border-field-border-focus transition-colors"
        >
          <InputGroup.TextArea
            placeholder="Type your message"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!uiState.activeChatId}
            rows={1}
            className="w-full resize-none px-4 py-2.5 bg-transparent text-field-foreground placeholder:text-field-placeholder text-base max-h-32 leading-relaxed min-h-[44px] disabled:opacity-50"
          />
          <InputGroup.Suffix className="flex items-center gap-1.5 px-3 py-2">
            <Button
              isIconOnly
              aria-label="Add emoji"
              size="sm"
              variant="ghost"
              isDisabled={!uiState.activeChatId}
              className="text-muted hover:bg-on-surface-hover"
            >
              <FaceSmile className="w-5 h-5" />
            </Button>
            <Button
              isIconOnly
              aria-label={messageContent.trim() ? "Send message" : "Voice input"}
              size="sm"
              variant={messageContent.trim() ? "primary" : "ghost"}
              isDisabled={!uiState.activeChatId || sending}
              isPending={sending}
              onPress={messageContent.trim() ? handleSend : undefined}
              className={messageContent.trim() ? "" : "text-muted hover:bg-on-surface-hover"}
            >
              {({ isPending }) =>
                isPending ? (
                  <Spinner color="current" size="sm" />
                ) : messageContent.trim() ? (
                  <PaperPlane className="w-4 h-4" />
                ) : (
                  <Microphone className="w-5 h-5" />
                )
              }
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
    </div>
  );
}