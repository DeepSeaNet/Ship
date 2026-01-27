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

    const createGroup = useCallback(async (
        groupName: string,
        options: {
            visibility?: 'public' | 'private',
            joinMode?: 'invite_only' | 'request_to_join' | 'open',
            description?: string,
            maxMembers?: number,
        } = {}
    ) => {
        setLoading(true);
        try {
            const result = await invoke<any>('create_group', {
                groupName,
                visibility: options.visibility || null,
                joinMode: options.joinMode || null,
                description: options.description || null,
                maxMembers: options.maxMembers || null,
            });

            if (result.success) {
                toast('Group created successfully', { variant: 'success' });
                await loadGroups(); // Refresh the list
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error creating group:', err);
            toast(`Failed to create group: ${err}`, { variant: 'danger' });
            return false;
        } finally {
            setLoading(false);
        }
    }, [loadGroups]);

    const updateGroupConfig = useCallback(async (
        groupId: string,
        updates: {
            name?: string;
            visibility?: 'public' | 'private';
            joinMode?: 'invite_only' | 'request_to_join' | 'open';
            description?: string;
            avatar?: string; // file path
            maxMembers?: number;
            slowModeDelay?: number;
            allowStickers?: boolean;
            allowGifs?: boolean;
            allowVoiceMessages?: boolean;
            allowVideoMessages?: boolean;
            allowLinks?: boolean;
            allowMessages?: boolean;
        }
    ) => {
        try {
            await invoke('update_group_config', {
                groupId,
                groupName: updates.name || null,
                visibility: updates.visibility || null,
                joinMode: updates.joinMode || null,
                description: updates.description || null,
                avatar: updates.avatar || null,
                maxMembers: updates.maxMembers || null,
                slowModeDelay: updates.slowModeDelay || null,
                allowStickers: updates.allowStickers || null,
                allowGifs: updates.allowGifs || null,
                allowVoiceMessages: updates.allowVoiceMessages || null,
                allowVideoMessages: updates.allowVideoMessages || null,
                allowLinks: updates.allowLinks || null,
                allowMessages: updates.allowMessages || null,
            });
            toast('Group configuration updated successfully', { variant: 'success' });
            return true;
        } catch (err) {
            console.error('Error updating group config:', err);
            toast(`Failed to update group config: ${err}`, { variant: 'danger' });
            return false;
        }
    }, []);

    const getGroupDisplayKey = useCallback(async (groupId: string) => {
        try {
            const key = await invoke<number[]>('get_group_display_key', { groupId });
            return new Uint8Array(key);
        } catch (err) {
            console.error('Error getting group display key:', err);
            return null;
        }
    }, []);

    const updateMemberPermissions = useCallback(async (
        groupId: string,
        memberId: number,
        permissions: Partial<Permissions>,
        role?: string
    ) => {
        try {
            await invoke('update_member_permissions', {
                groupId,
                memberId,
                permissions,
                role: role || null,
            });
            toast('Member permissions updated successfully', { variant: 'success' });
            return true;
        } catch (err) {
            console.error('Error updating member permissions:', err);
            toast(`Failed to update member permissions: ${err}`, { variant: 'danger' });
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
        createGroup,
        updateGroupConfig,
        getGroupDisplayKey,
        updateMemberPermissions,
    };
}
