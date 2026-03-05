'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, TextField, InputGroup, Spinner, Card } from '@heroui/react';
import { Plus, FaceSmile, Microphone, PaperPlane, Xmark, ArrowLeft, Pencil } from '@gravity-ui/icons';
import { useMessengerState } from '@/hooks/useMessengerState';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useChats } from '@/hooks';
import { Message } from '@/hooks/messengerTypes';

interface InputBarProps {
  replyTo?: Message | null;
  editTarget?: Message | null;
  onClearReply?: () => void;
  onClearEdit?: () => void;
}

export function InputBar({ replyTo, editTarget, onClearReply, onClearEdit }: InputBarProps) {
  const { uiState, users } = useMessengerState();
  const { sendMessage, sending } = useSendMessage();
  const [messageContent, setMessageContent] = useState('');
  const { getChatById } = useChats();
  const activeChat = uiState.activeChatId ? getChatById(uiState.activeChatId) : null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);

  // When editTarget changes, pre-fill input
  useEffect(() => {
    if (editTarget) {
      setMessageContent(editTarget.content);
      textareaRef.current?.focus();
    } else if (!editTarget) {
      // Only clear if we were in edit mode
    }
  }, [editTarget?.id]);

  // When replyTo changes, focus the textarea
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo?.id]);

  // Derive members for autocomplete
  const memberSuggestions = useCallback(() => {
    if (!activeChat?.members) return [];
    return activeChat.members
      .map(id => users[id.toString()])
      .filter(Boolean)
      .filter(u => !mentionQuery || u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()));
  }, [activeChat?.members, users, mentionQuery]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessageContent(val);

    // Detect @mention pattern: find last @ before cursor
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1) {
      const fragment = before.slice(atIdx + 1);
      // Show autocomplete only if no space after @
      if (!fragment.includes(' ')) {
        setMentionQuery(fragment);
        setMentionStart(atIdx);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (name: string) => {
    const before = messageContent.slice(0, mentionStart);
    const after = messageContent.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setMessageContent(`${before}@${name} ${after}`);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSend = () => {
    if (!uiState.activeChatId || !messageContent.trim() || sending) return;
    const contentToSend = messageContent;
    setMessageContent('');
    setMentionQuery(null);
    sendMessage(uiState.activeChatId, contentToSend, {
      replyTo: replyTo?.id,
      editId: editTarget?.id,
    });
    onClearReply?.();
    onClearEdit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setMentionQuery(null);
      onClearReply?.();
      onClearEdit?.();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = memberSuggestions();
  const showAutocomplete = mentionQuery !== null && suggestions.length > 0;

  const isEditing = !!editTarget;
  const isReplying = !!replyTo;

  return (
    <div className="flex flex-col bg-background">
      {/* Reply banner */}
      {isReplying && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-accent/5 animate-in slide-in-from-bottom-2 duration-200">
          <ArrowLeft className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-accent font-semibold">{replyTo!.senderName ?? 'User'}</p>
            <p className="text-xs text-muted truncate">{replyTo!.content}</p>
          </div>
          <Button isIconOnly size="sm" variant="ghost" className="text-muted shrink-0" onPress={onClearReply}>
            <Xmark className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Edit banner */}
      {isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-warning/5 animate-in slide-in-from-bottom-2 duration-200">
          <Pencil className="w-4 h-4 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-warning font-semibold">Editing message</p>
            <p className="text-xs text-muted truncate">{editTarget!.content}</p>
          </div>
          <Button isIconOnly size="sm" variant="ghost" className="text-muted shrink-0" onPress={() => { onClearEdit?.(); setMessageContent(''); }}>
            <Xmark className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* @mention autocomplete popup */}
      {showAutocomplete && (
        <div className="mx-4 mb-1 border border-border rounded-xl bg-surface shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {suggestions.slice(0, 6).map(user => (
            <button
              key={user.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/10 transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); insertMention(user.name); }}
            >
              <span className="font-medium text-accent">@</span>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[72px] flex items-center px-4 gap-3 py-3">
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

        {/* TextField */}
        <TextField
          fullWidth
          aria-label="Message input"
          name="message"
          className="flex-1"
        >
          <InputGroup
            fullWidth
            className={`rounded-2xl border focus-within:border-field-border-focus transition-colors ${
              isEditing ? 'bg-warning/5 border-warning/30' : 'bg-surface border-field-border'
            }`}
          >
            <InputGroup.TextArea
              ref={textareaRef}
              placeholder={isEditing ? 'Edit your message…' : 'Type your message'}
              value={messageContent}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              disabled={!uiState.activeChatId || !activeChat?.user_permissions?.send_messages}
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
                aria-label={messageContent.trim() ? (isEditing ? 'Save edit' : 'Send message') : 'Voice input'}
                size="sm"
                variant={messageContent.trim() ? (isEditing ? 'secondary' : 'primary') : 'ghost'}
                isDisabled={!uiState.activeChatId || sending}
                isPending={sending}
                onPress={messageContent.trim() ? handleSend : undefined}
                className={messageContent.trim() ? '' : 'text-muted hover:bg-on-surface-hover'}
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
    </div>
  );
}