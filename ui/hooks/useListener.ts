"use client";

import { toast } from "@heroui/react";
import type React from "react";
import { useEffect, useRef } from "react";
import { onServerEvent } from "./generated";
import { createMediaUrl } from "./helper";
import type {
	Chat,
	Group,
	GroupConfig,
	Message,
	UIState,
	User,
} from "./messengerTypes";
import { mapGroupConfig } from "./useGroups";
import { getNotificationSettings } from "./useNotificationSettings";

interface ListenerProps {
	currentUser: User | null;
	uiStateRef: React.RefObject<UIState>;
	chatsRef: React.RefObject<Chat[]>;
	contactsRef: React.RefObject<Record<string, User>>;
	actions: {
		addMessage: (chatId: string, message: Message) => void;
		setActiveChatId: (id: string | null) => void;
		fetchChats: () => Promise<void>;
		setIsLoading: (loading: boolean) => void;
		setCurrentUser: (user: User | null) => void;
		setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
		setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
		setUIState: React.Dispatch<React.SetStateAction<UIState>>;
		editMessage: (
			chatId: string,
			messageId: string,
			newContent: string,
		) => void;
		updateMessageStatus: (
			chatId: string,
			messageId: string,
			status: Message["status"],
		) => void;
		updateMessageId: (chatId: string, oldId: string, newId: string) => void;
		upsertUser: (user: Partial<User> & { id: string }) => void;
	};
}

export function useListener({
	currentUser,
	uiStateRef,
	chatsRef,
	contactsRef,
	actions,
}: ListenerProps) {
	const unlistenRef = useRef<(() => void) | null>(null);
	const currentUserRef = useRef<User | null>(currentUser);

	useEffect(() => {
		currentUserRef.current = currentUser;
	}, [currentUser]);

	useEffect(() => {
		let isMounted = true;

		const setupListener = async () => {
			// Cleanup existing listener if any
			if (unlistenRef.current) {
				unlistenRef.current();
				unlistenRef.current = null;
			}

			// Setup Tauri Event Listener FIRST
			const unlisten = await onServerEvent((payload) => {
				if (!isMounted) return;

				console.log("Received server event:", payload);

				if (!payload?.type) return;

				switch (payload.type) {
					case "new_group_message": {
						const data = payload.data;
						const chatId = data.group_id;

						const chats = chatsRef.current;
						const contacts = contactsRef.current;
						const currentLocalUser = currentUserRef.current;

						const chat = chats?.find((c) => c.id === chatId);
						const senderId = data.sender_id?.toString() || "0";
						const sender = contacts?.[senderId];
						const senderName = sender?.name || `User ${senderId}`;

						const message: Message = {
							id: data.message_id.toString(),
							chatId,
							senderId,
							content: data.text,
							timestamp: new Date(data.timestamp * 1000).toISOString(),
							isOwn:
								data.sender_id === currentLocalUser?.id ||
								data.sender_id?.toString() === currentLocalUser?.id,
							status: "sent",
							media: data.media,
							media_name: data.media_name,
							reply_to: data.reply_message_id?.toString(),
							edited: Boolean(data.edit_date),
							expires: data.expires,
						};

						if (data.is_edit) {
							actions.editMessage(
								chatId,
								data.message_id.toString(),
								data.text,
							);
						} else {
							actions.addMessage(chatId, message);
						}

						const currentUI = uiStateRef.current;
						const isCurrentlyActive =
							currentUI?.activeChatId === chatId ||
							currentUI?.activeGroupId === chatId;

						if (!isCurrentlyActive && !message.isOwn) {
							const notifSettings = getNotificationSettings();
							const override = notifSettings.chatOverrides[chatId];
							const isGroup = Boolean(data.group_id);

							if (override?.muted) return;

							const useMentionsOnly =
								override?.mentionsOnly ?? notifSettings.mentionsOnly;

							const mentionTriggered =
								!useMentionsOnly ||
								message.content.includes(
									`@${localStorage.getItem("username") || ""}`,
								);

							const shouldShow =
								!notifSettings.doNotDisturb &&
								notifSettings.enableToasts &&
								(isGroup
									? notifSettings.groupMessages
									: notifSettings.directMessages) &&
								mentionTriggered;

							const username = localStorage.getItem("username") || "";
							const isMentioned =
								username && message.content.includes(`@${username}`);

							if (shouldShow || isMentioned) {
								toast(`From ${senderName || senderId}`, {
									description: `In "${chat?.name || "Unknown"}": ${message.content}`,
									variant: "accent",
									actionProps: {
										children: "Open",
										onPress: () => {
											actions.setActiveChatId(chatId);
										},
									},
								});
							}
						}
						break;
					}

					case "join_group":
						actions.setGroups((prevGroups) => {
							const groupData = payload.data;
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
						break;

					case "group_config_updated": {
						const groupData = payload.data;
						const groupId = groupData.group_id;

						actions.setGroups((prevGroups) =>
							prevGroups.map((g) => {
								if (String(g.id) === String(groupId)) {
									return {
										...g,
										name: groupData.group_config.name ?? g.name,
										avatar: createMediaUrl(groupData.avatar) ?? g.avatar,
										group_config: mapGroupConfig(groupData.group_config),
									};
								}
								return g;
							}),
						);

						actions.setChats((prevChats) =>
							prevChats.map((c) => {
								if (c.isGroup && String(c.id) === String(groupId)) {
									return {
										...c,
										name: groupData.group_config.name ?? c.name,
										avatar: createMediaUrl(groupData.avatar) ?? c.avatar,
										group_config: {
											...c.group_config,
											...groupData,
										} as GroupConfig,
									};
								}
								return c;
							}),
						);
						break;
					}
					case "user_status_changed": {
						const data = payload.data;
						if (data.user_id) {
							actions.upsertUser({
								id: String(data.user_id),
								status: data.status,
							});
						}
						break;
					}

					case "message_delivery": {
						const { message_id, success } = payload.data;
						uiStateRef.current?.loadedChatIds.forEach((chatId) => {
							actions.updateMessageStatus(
								chatId,
								message_id.toString(),
								success ? "sent" : "error",
							);
						});
						break;
					}

					default:
						console.log("Unhandled event type:", payload.type);
				}
			});

			if (!isMounted) {
				unlisten();
				return;
			}
			unlistenRef.current = unlisten;

			// Initial Data Loading
			actions.setIsLoading(true);
			await actions.fetchChats();

			if (!isMounted) return;
			actions.setIsLoading(false);
		};

		setupListener();

		return () => {
			isMounted = false;
			if (unlistenRef.current) {
				unlistenRef.current();
				unlistenRef.current = null;
			}
		};
	}, [actions.fetchChats]);
}
