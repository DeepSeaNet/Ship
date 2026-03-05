'use client';
import { ReactNode } from 'react';
import { Message } from './messengerTypes';
import { TrashBin, Copy, ArrowLeft, Pencil } from '@gravity-ui/icons';

export interface MessageAction {
    id: string;
    label: string;
    icon: ReactNode;
    intent?: "danger" | "default";
    shortcut?: string;
}

interface UseMessageActionsOptions {
    onReply?: (msg: Message) => void;
    onEdit?: (msg: Message) => void;
    onDelete?: (msg: Message) => void;
}

export function useMessageActions(
    message: Message,
    { onReply, onEdit, onDelete }: UseMessageActionsOptions = {}
) {
    const handleAction = (key: string | number) => {
        if (key === 'copy') {
            navigator.clipboard.writeText(message.content)
                .catch(err => console.error('Failed to copy', err));
        } else if (key === 'reply') {
            onReply?.(message);
        } else if (key === 'edit') {
            onEdit?.(message);
        } else if (key === 'delete') {
            onDelete?.(message);
        }
    };

    const actions: MessageAction[] = [
        {
            id: 'reply',
            label: 'Reply',
            icon: <ArrowLeft className="size-4 shrink-0 text-muted" />,
            shortcut: 'R'
        },
        {
            id: 'copy',
            label: 'Copy Text',
            icon: <Copy className="size-4 shrink-0 text-muted" />,
            shortcut: 'C'
        },
    ];

    if (message.isOwn) {
        actions.push({
            id: 'edit',
            label: 'Edit Message',
            icon: <Pencil className="size-4 shrink-0 text-muted" />,
            shortcut: 'E'
        });
        actions.push({
            id: 'delete',
            label: 'Delete Message',
            icon: <TrashBin className="size-4 shrink-0 text-danger" />,
            intent: 'danger',
            shortcut: 'Del'
        });
    }

    return { actions, handleAction };
}
