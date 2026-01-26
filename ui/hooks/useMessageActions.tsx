'use client';
import { ReactNode } from 'react';
import { Message } from './messengerTypes';
import { TrashBin, Copy, ArrowLeft } from '@gravity-ui/icons';

export interface MessageAction {
    id: string;
    label: string;
    icon: ReactNode;
    // Using 'color' name in my interface but will map to 'variant' or 'color' in component as needed
    intent?: "danger" | "default";
    shortcut?: string;
}

export function useMessageActions(message: Message) {
    const handleAction = (key: string | number) => {
        if (key === 'copy') {
            navigator.clipboard.writeText(message.content)
                .catch(err => console.error('Failed to copy', err));
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
            id: 'delete',
            label: 'Delete Message',
            icon: <TrashBin className="size-4 shrink-0 text-danger" />,
            intent: 'danger',
            shortcut: 'Del'
        });
    }

    return { actions, handleAction };
}
