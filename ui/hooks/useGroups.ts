"use client";

import { toast } from "@heroui/react";
import { useCallback, useState } from "react";
import type {
	GroupConfig as BackendGroupConfig,
	Permissions,
} from "./generated";
import {
	getAllGroupMedia,
	getGroups,
	createGroup as invokeCreateGroup,
	getGroupDisplayKey as invokeGetGroupDisplayKey,
	inviteToGroup as invokeInviteUserToGroup,
	removeFromGroup as invokeRemoveFromGroup,
	updateGroupConfig as invokeUpdateGroupConfig,
	updateMemberPermissions as invokeUpdateMemberPermissions,
} from "./generated";
import { createMediaUrl } from "./helper";
import type { Group, GroupConfig, User } from "./messengerTypes";

export function mapGroupConfig(config: BackendGroupConfig): GroupConfig {
	return {
		...config,
		creator_id: String(config.creator_id),
		members: config.members.map(String),
		admins: config.admins.map(String),
		banned: config.banned.map(String),
		permissions: Object.fromEntries(
			Object.entries(config.permissions).map(([k, v]) => [String(k), v]),
		),

		muted: Object.fromEntries(
			Object.entries(config.muted).map(([k, v]) => [String(k), v]),
		),
		pinned_message_id: String(config.pinned_message_id),
	};
}

export function useGroups(currentUser?: User | null) {
	const [groups, setGroups] = useState<Group[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const fetchGroups = useCallback(async () => {
		setIsLoading(true);
		try {
			const loadedGroups = await getGroups();
			if (!loadedGroups) {
				console.error("Failed to fetch groups");
				return [];
			}
			const formattedGroups: Group[] = loadedGroups.map((group) => ({
				id: group.group_id,
				name: group.group_config.name,
				avatar: createMediaUrl(group.avatar),
				unreadCount: 0,
				isGroup: true,
				group_config: mapGroupConfig(group.group_config),
				lastMessage: group.last_message?.content || "",
				lastMessageTime: group.last_message?.timestamp
					? new Date(group.last_message.timestamp).toISOString()
					: group.group_config.created_at
						? new Date(group.group_config.created_at.timestamp).toISOString()
						: undefined,
				loaded: false,
			}));

			setGroups(formattedGroups);
			return formattedGroups;
		} catch (error) {
			console.error("Error fetching groups:", error);
			toast("Failed to load groups", { variant: "danger" });
			return [];
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Helper: Permissions check (using currentUser from context if available, else localStorage backup)
	const checkPermission = useCallback(
		(group: Group | null, permissionKey: keyof Permissions): boolean => {
			if (!group) return false;

			const userId = currentUser?.id;
			if (!userId) return false;

			if (group.group_config?.creator_id === userId) return true;
			if (group.group_config?.admins?.includes(userId)) return true;

			const user_permissions = group.group_config?.permissions[userId];

			if (user_permissions) {
				return Boolean(user_permissions[permissionKey]);
			}

			if (group.group_config?.default_permissions) {
				return Boolean(group.group_config.default_permissions[permissionKey]);
			}

			return false;
		},
		[currentUser],
	);

	// --- Actions (Keep these as they are performative, but they should trigger state updates via events or context refresh)

	const inviteUserToGroup = useCallback(
		async (groupId: string, userId: number) => {
			try {
				await invokeInviteUserToGroup({ userId, groupId });
				return true;
			} catch (err) {
				console.error("Error inviting user:", err);
				toast(`Failed to invite user: ${err}`, { variant: "danger" });
				return false;
			}
		},
		[],
	);

	const removeUserFromGroup = useCallback(
		async (groupId: string, userId: number) => {
			try {
				await invokeRemoveFromGroup({
					userId,
					groupId,
				});

				toast("User removed successfully", { variant: "success" });
				// Ideally, we'd refresh groups here or wait for an event
				fetchGroups();
				return true;
			} catch (err) {
				console.error("Error removing user:", err);
				toast(`Failed to remove user: ${err}`, { variant: "danger" });
				return false;
			}
		},
		[fetchGroups],
	);

	const createGroup = useCallback(
		async (
			groupName: string,
			options: {
				visibility?: "public" | "private";
				joinMode?: "invite_only" | "request_to_join" | "open";
				description?: string;
				maxMembers?: number;
			} = {},
		) => {
			try {
				const result = await invokeCreateGroup({
					groupName,
					visibility: options.visibility || null,
					joinMode: options.joinMode || null,
					description: options.description || null,
					maxMembers: options.maxMembers || null,
				});

				if (result) {
					toast("Group created successfully", { variant: "success" });
					setGroups((prevGroups) => {
						const groupData = result;
						console.log("Group created successfully", groupData);
						const groupId = groupData.group_id;
						const groupConfig = groupData.group_config;
						const avatar = groupData.avatar;
						const group: Group = {
							id: groupId,
							name: groupConfig.name,
							avatar: createMediaUrl(avatar),
							unreadCount: 0,
							isGroup: true,
							group_config: mapGroupConfig(groupConfig),
						};
						return [...prevGroups, group];
					});
					return true;
				}
				return false;
			} catch (err) {
				console.error("Error creating group:", err);
				toast(`Failed to create group: ${err}`, { variant: "danger" });
				return false;
			}
		},
		[setGroups],
	);

	const updateGroupConfig = useCallback(
		async (
			groupId: string,
			updates: {
				name?: string;
				visibility?: "public" | "private";
				joinMode?: "invite_only" | "request_to_join" | "open";
				description?: string;
				avatarPath?: string; // fallback or legacy
				avatarBytes?: Uint8Array;
				avatarHash?: string;
				avatarWidth?: number;
				avatarHeight?: number;
				avatarMimeType?: string;
				maxMembers?: number;
				slowModeDelay?: number;
				allowStickers?: boolean;
				allowGifs?: boolean;
				allowVoiceMessages?: boolean;
				allowVideoMessages?: boolean;
				allowLinks?: boolean;
				allowMessages?: boolean;
			},
		) => {
			try {
				console.log("Updating group config:", updates);
				let avatarHash = updates.avatarHash;

				if (updates.avatarBytes) {
					// Calculate hash if not provided
					if (!avatarHash) {
						const hashBuffer = await crypto.subtle.digest(
							"SHA-256",
							updates.avatarBytes as BufferSource,
						);
						avatarHash = Array.from(new Uint8Array(hashBuffer))
							.map((b) => b.toString(16).padStart(2, "0"))
							.join("");
					}
				}

				await invokeUpdateGroupConfig({
					groupId,
					groupName: updates.name,
					visibility: updates.visibility,
					joinMode: updates.joinMode,
					description: updates.description,
					avatar: updates.avatarBytes ? Array.from(updates.avatarBytes) : null,
					maxMembers: updates.maxMembers,
					slowModeDelay: updates.slowModeDelay,
					allowStickers: updates.allowStickers,
					allowGifs: updates.allowGifs,
					allowVoiceMessages: updates.allowVoiceMessages,
					allowVideoMessages: updates.allowVideoMessages,
					allowLinks: updates.allowLinks,
					allowMessages: updates.allowMessages,
				});
				toast("Group configuration updated successfully", {
					variant: "success",
				});
				fetchGroups();
				return true;
			} catch (err) {
				console.error("Error updating group config:", err);
				toast(`Failed to update group config: ${err}`, { variant: "danger" });
				return false;
			}
		},
		[fetchGroups],
	);

	const getGroupDisplayKey = useCallback(async (groupId: string) => {
		try {
			const key = await invokeGetGroupDisplayKey({ groupId });
			return new Uint8Array(key);
		} catch (err) {
			console.error("Error getting group display key:", err);
			return null;
		}
	}, []);

	const updateMemberPermissions = useCallback(
		async (
			groupId: string,
			memberId: number,
			permissions: Partial<Permissions>,
			role?: string,
		) => {
			try {
				await invokeUpdateMemberPermissions({groupId, memberId, permissions, role});
				toast("Member permissions updated successfully", {
					variant: "success",
				});
				fetchGroups();
				return true;
			} catch (err) {
				console.error("Error updating member permissions:", err);
				toast(`Failed to update member permissions: ${err}`, {
					variant: "danger",
				});
				return false;
			}
		},
		[fetchGroups],
	);

	const getGroupMedia = useCallback(async (groupId: string) => {
		try {
			const mediaResponse = await getAllGroupMedia({
				groupName: groupId,
			});
			return mediaResponse.media;
		} catch (err) {
			console.error("Error getting group media:", err);
			return [];
		}
	}, []);

	return {
		groups,
		loading: isLoading,
		error: null,
		loadGroups: fetchGroups, // Alias for compatibility
		getGroupMedia,
		fetchGroups,
		setGroups,
		checkPermission,
		inviteUserToGroup,
		removeUserFromGroup,
		createGroup,
		updateGroupConfig,
		getGroupDisplayKey,
		updateMemberPermissions,
	};
}
