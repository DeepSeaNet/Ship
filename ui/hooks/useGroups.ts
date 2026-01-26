'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@heroui/react';
import { Group, Permissions } from './messengerTypes';

// Helper for media URLs
const createMediaUrl = (avatarData: string | undefined): string | undefined => {
    if (!avatarData) return undefined;
    if (avatarData.startsWith('data:') || avatarData.startsWith('http')) return avatarData;
    return `data:image/png;base64,${avatarData}`;
};

const formatChatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    if (diff < dayMs && now.getDate() === date.getDate()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < dayMs * 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
};

export function useGroups() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadGroups = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const loadedGroups = await invoke<any[]>('get_groups');
            const formattedGroups: Group[] = loadedGroups.map((group: any) => ({
                id: group.group_id,
                name: group.group_name,
                avatar: createMediaUrl(group.avatar),
                unreadCount: 0, // Backend might need to provide this
                isGroup: true,
                participants: group.members,
                description: group.description,
                owner_id: group.owner_id,
                admins: group.admins,
                members: group.members,
                group_config: group.group_config || null,
                user_permissions: group.user_permissions,
                users_permissions: group.users_permisions, // note: backend has 'permisions'
                default_permissions: group.default_permissions,
                lastMessage: group.last_message?.text || group.last_message?.content || '',
                lastMessageTime: formatChatTime(group.last_message?.timestamp
                    ? new Date(group.last_message.timestamp * 1000).toISOString()
                    : group.date ? new Date(group.date * 1000).toISOString() : undefined),
                loaded: false,
            }));

            // Sort by last message timestamp
            formattedGroups.sort((a, b) => {
                const aTs = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                const bTs = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                return bTs - aTs;
            });

            setGroups(formattedGroups);
            return formattedGroups;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Error loading groups:', err);
            setError(msg);
            toast(`Failed to load groups: ${msg}`, { variant: 'danger' });
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const checkPermission = useCallback(
        (group: Group | null, permissionKey: keyof Permissions): boolean => {
            if (!group) return false;

            // In a real app, we'd get the current user ID from a context/store
            const currentUserIdStr = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
            if (!currentUserIdStr) return false;
            const userId = parseInt(currentUserIdStr);

            if (group.owner_id && Number(group.owner_id) === userId) return true;
            if (group.admins?.includes(userId)) return true;

            if (group.user_permissions) {
                return !!(group.user_permissions as any)[permissionKey];
            }

            if (group.users_permissions && (group.users_permissions as any)[userId]) {
                return !!(group.users_permissions as any)[userId][permissionKey];
            }

            if (group.default_permissions) {
                return !!(group.default_permissions as any)[permissionKey];
            }

            return false;
        },
        []
    );

    const inviteUserToGroup = useCallback(async (groupId: string, userId: number) => {
        try {
            await invoke('invite_to_group', {
                clientId: userId,
                groupName: groupId,
            });

            toast('User invited successfully', { variant: 'success' });
            return true;
        } catch (err) {
            console.error('Error inviting user:', err);
            toast(`Failed to invite user: ${err}`, { variant: 'danger' });
            return false;
        }
    }, []);

    const removeUserFromGroup = useCallback(async (groupId: string, userId: number) => {
        try {
            await invoke('remove_from_group', {
                userId,
                groupId,
            });

            toast('User removed successfully', { variant: 'success' });
            return true;
        } catch (err) {
            console.error('Error removing user:', err);
            toast(`Failed to remove user: ${err}`, { variant: 'danger' });
            return false;
        }
    }, []);

    return {
        groups,
        loading,
        error,
        loadGroups,
        checkPermission,
        inviteUserToGroup,
        removeUserFromGroup,
    };
}
