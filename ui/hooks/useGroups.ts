'use client';

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@heroui/react';
import { Group, Permissions } from './messengerTypes';
import { useMessengerState } from './useMessengerState';

export function useGroups() {
    const { groups, isLoading, fetchGroups, currentUser } = useMessengerState();

    // Helper: Permissions check (using currentUser from context if available, else localStorage backup)
    const checkPermission = useCallback(
        (group: Group | null, permissionKey: keyof Permissions): boolean => {
            if (!group) return false;

            // Use context user, fallback to localstorage
            let userId = currentUser ? parseInt(currentUser.id) : null;
            if (!userId && typeof window !== 'undefined') {
                const stored = localStorage.getItem('userId');
                if (stored) userId = parseInt(stored);
            }
            if (!userId) return false;

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
        [currentUser]
    );

    // --- Actions (Keep these as they are performative, but they should trigger state updates via events or context refresh)

    const inviteUserToGroup = useCallback(async (groupId: string, userId: number) => {
        try {
            await invoke('invite_to_group', {
                clientId: userId,
                groupName: groupId,
            });
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
            // Ideally, we'd refresh groups here or wait for an event
            fetchGroups();
            return true;
        } catch (err) {
            console.error('Error removing user:', err);
            toast(`Failed to remove user: ${err}`, { variant: 'danger' });
            return false;
        }
    }, [fetchGroups]);

    const createGroup = useCallback(async (
        groupName: string,
        options: {
            visibility?: 'public' | 'private',
            joinMode?: 'invite_only' | 'request_to_join' | 'open',
            description?: string,
            maxMembers?: number,
        } = {}
    ) => {
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
                await fetchGroups(); // Refresh the list
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error creating group:', err);
            toast(`Failed to create group: ${err}`, { variant: 'danger' });
            return false;
        }
    }, [fetchGroups]);

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
            console.log('Updating group config:', updates);
            await invoke('update_group_config', {
                groupId,
                groupName: updates.name,
                visibility: updates.visibility,
                joinMode: updates.joinMode,
                description: updates.description,
                avatar: updates.avatar,
                maxMembers: updates.maxMembers,
                slowModeDelay: updates.slowModeDelay,
                allowStickers: updates.allowStickers,
                allowGifs: updates.allowGifs,
                allowVoiceMessages: updates.allowVoiceMessages,
                allowVideoMessages: updates.allowVideoMessages,
                allowLinks: updates.allowLinks,
                allowMessages: updates.allowMessages,
            });
            toast('Group configuration updated successfully', { variant: 'success' });
            fetchGroups();
            return true;
        } catch (err) {
            console.error('Error updating group config:', err);
            toast(`Failed to update group config: ${err}`, { variant: 'danger' });
            return false;
        }
    }, [fetchGroups]);

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
            fetchGroups();
            return true;
        } catch (err) {
            console.error('Error updating member permissions:', err);
            toast(`Failed to update member permissions: ${err}`, { variant: 'danger' });
            return false;
        }
    }, [fetchGroups]);

    return {
        groups,
        loading: isLoading,
        error: null,
        loadGroups: fetchGroups, // Alias for compatibility
        checkPermission,
        inviteUserToGroup,
        removeUserFromGroup,
        createGroup,
        updateGroupConfig,
        getGroupDisplayKey,
        updateMemberPermissions,
    };
}
