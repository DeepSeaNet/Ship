'use client';
import { useState, useCallback } from 'react';
import { Message } from './messengerTypes';

export interface ComposeState {
  replyTo: Message | null;
  editTarget: Message | null;
}

export function useComposeState() {
  const [replyTo, setReplyToState] = useState<Message | null>(null);
  const [editTarget, setEditTargetState] = useState<Message | null>(null);

  const setReplyTo = useCallback((msg: Message | null) => {
    setReplyToState(msg);
    setEditTargetState(null); // Clear edit when replying
  }, []);

  const setEditTarget = useCallback((msg: Message | null) => {
    setEditTargetState(msg);
    setReplyToState(null); // Clear reply when editing
  }, []);

  const clearReply = useCallback(() => setReplyToState(null), []);
  const clearEdit = useCallback(() => setEditTargetState(null), []);

  const clearAll = useCallback(() => {
    setReplyToState(null);
    setEditTargetState(null);
  }, []);

  return { replyTo, editTarget, setReplyTo, setEditTarget, clearReply, clearEdit, clearAll };
}
