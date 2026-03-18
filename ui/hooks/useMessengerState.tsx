"use client";

import { toast } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createMediaUrl } from "./helper";
import type {
	Chat,
	Group,
	Message,
	MessengerContextType,
	UIState,
	User,
} from "./messengerTypes";
import { useContacts } from "./useContacts";
import { useListener } from "./useListener";
import { useGroups } from "./useGroups";

const defaultUIState: UIState = {
	activeChatId: null,
	activeGroupId: null,
	rightSidebarOpen: false,
	isAnimatingIn: false,
	loadedChatIds: [],
};

const MessengerContext = createContext<MessengerContextType | undefined>(
	undefined,
);

interface MessengerProviderProps {
	children: ReactNode;
}

export function MessengerProvider({ children }: MessengerProviderProps) {
	// --- State ---
	const [uiState, setUIState] = useState<UIState>(defaultUIState);
	const [messagesByChat, setMessagesByChat] = useState<
		Record<string, Message[]>
	>({});
	const [chats, setChats] = useState<Chat[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const uiStateRef = useRef(uiState);
	const { contacts, setContacts, getUserInfo } = useContacts();
	const { groups, setGroups, fetchGroups } = useGroups(currentUser);
	useEffect(() => {
		uiStateRef.current = uiState;
	}, [uiState]);

	const chatsRef = useRef<Chat[]>(chats);
	useEffect(() => {
		chatsRef.current = chats;
	}, [chats]);

	const contactsRef = useRef<Record<string, User>>(contacts);
	useEffect(() => {
		contactsRef.current = contacts;
	}, [contacts]);

	// --- Fetchers ---

	const fetchChats = useCallback(async (): Promise<void> => {
		try {
			// Fetch groups via the new hook
			const formattedGroups = await fetchGroups();

			// Fetch private chats (placeholder for now as per previous implementation)
			const privateChats = await invoke<any[]>("get_chats");
			const formattedPrivateChats: Chat[] = privateChats.map((chat: any) => ({
				id: chat.id,
				name: chat.name,
				avatar: chat.avatar,
				unreadCount: chat.unread_count || 0,
				isGroup: false,
				lastMessage: chat.last_message?.text,
				lastMessageTime: chat.last_message?.timestamp
					? new Date(chat.last_message.timestamp * 1000).toISOString()
					: undefined,
			}));

			// Combine and sort
			const allChats = [...formattedGroups, ...formattedPrivateChats].sort(
				(a, b) => {
					const aTime = a.lastMessageTime
						? new Date(a.lastMessageTime).getTime()
						: 0;
					const bTime = b.lastMessageTime
						? new Date(b.lastMessageTime).getTime()
						: 0;
					return bTime - aTime;
				},
			);

			setChats(allChats);
		} catch (error) {
			console.error("Error fetching chats/groups:", error);
			toast("Failed to load chats", { variant: "danger" });
		}
	}, [fetchGroups]);

	const fetchChatsStable = useCallback(async () => {
		await fetchChats();
	}, [fetchChats]);

	const fetchGroupsStable = useCallback(async () => {
		await fetchGroups();
	}, [fetchGroups]);

	// --- Actions ---

	const setActiveChatId = (id: string | null) => {
		const isGroup = chatsRef.current.find((c) => c.id === id)?.isGroup || false;
		console.log("Setting active chat to:", id, "isGroup:", isGroup);
		setUIState((prev) => ({
			...prev,
			activeChatId: id,
			activeGroupId: isGroup ? id : null,
		}));
	};

	const setActiveGroupId = (id: string | null) => {
		setActiveChatId(id);
	};

	const toggleRightSidebar = () => {
		setUIState((prev) => ({
			...prev,
			rightSidebarOpen: !prev.rightSidebarOpen,
		}));
	};

	const setAnimatingIn = (animating: boolean) => {
		setUIState((prev) => ({
			...prev,
			isAnimatingIn: animating,
		}));
	};

	const addMessage = (chatId: string, message: Message) => {
		setMessagesByChat((prev) => ({
			...prev,
			[chatId]: [...(prev[chatId] || []), message],
		}));

		// Update last message in chat list
		setChats((prevChats) =>
			prevChats
				.map((chat) => {
					if (chat.id === chatId) {
						return {
							...chat,
							lastMessage: message.content,
							lastMessageTime: message.timestamp || new Date().toISOString(), // Fallback if timestamp missing
						};
					}
					return chat;
				})
				.sort((a, b) => {
					const aTime = a.lastMessageTime
						? new Date(a.lastMessageTime).getTime()
						: 0;
					const bTime = b.lastMessageTime
						? new Date(b.lastMessageTime).getTime()
						: 0;
					return bTime - aTime;
				}),
		);
	};

	const setMessagesForChat = (chatId: string, messages: Message[]) => {
		setMessagesByChat((prev) => ({
			...prev,
			[chatId]: messages,
		}));
	};

	const updateMessageStatus = (
		chatId: string,
		messageId: string,
		status: Message["status"],
	) => {
		setMessagesByChat((prev) => {
			const chatMessages = prev[chatId];
			if (!chatMessages) return prev;

			return {
				...prev,
				[chatId]: chatMessages.map((msg) =>
					msg.id === messageId ? { ...msg, status } : msg,
				),
			};
		});
	};

	const updateMessageId = (chatId: string, oldId: string, newId: string) => {
		setMessagesByChat((prev) => {
			const chatMessages = prev[chatId];
			if (!chatMessages) return prev;

			return {
				...prev,
				[chatId]: chatMessages.map((msg) =>
					msg.id === oldId ? { ...msg, id: newId } : msg,
				),
			};
		});
	};

	const editMessage = (
		chatId: string,
		messageId: string,
		newContent: string,
	) => {
		setMessagesByChat((prev) => {
			const chatMessages = prev[chatId];
			if (!chatMessages) return prev;
			return {
				...prev,
				[chatId]: chatMessages.map((msg) =>
					msg.id === messageId
						? { ...msg, content: newContent, edited: true }
						: msg,
				),
			};
		});
	};

	const markChatAsLoaded = (chatId: string) => {
		setUIState((prev) => {
			if (prev.loadedChatIds.includes(chatId)) return prev;
			return {
				...prev,
				loadedChatIds: [...prev.loadedChatIds, chatId],
			};
		});
	};

	const upsertUser = (user: User) => {
		setContacts((prev) => {
			return {
				...prev,
				[user.id]: { ...(prev[user.id] || {}), ...user },
			};
		});
	};

	// --- Event Listener ---
	const listenerActions = useMemo(
		() => ({
			addMessage,
			setActiveChatId,
			fetchChats: fetchChatsStable,
			setIsLoading,
			setCurrentUser,
			setGroups,
			setChats,
			setUIState,
			editMessage,
			updateMessageStatus,
			updateMessageId,
			upsertUser,
		}),
		[
			addMessage,
			setActiveChatId,
			fetchChatsStable,
			setIsLoading,
			setCurrentUser,
			setGroups,
			setChats,
			setUIState,
			editMessage,
			updateMessageStatus,
			updateMessageId,
			upsertUser,
		],
	);

	useListener({
		currentUser,
		uiStateRef,
		chatsRef,
		contactsRef,
		actions: listenerActions,
	});
	// Re-run if methods change, though useCallback handles stability

	const value: MessengerContextType = useMemo(
		() => ({
			uiState,
			messagesByChat,
			chats,
			groups,
			isLoading,
			currentUser,
			setActiveChatId,
			setActiveGroupId,
			toggleRightSidebar,
			setAnimatingIn,
			addMessage,
			setMessagesForChat,
			updateMessageStatus,
			updateMessageId,
			editMessage,
			markChatAsLoaded,
			upsertUser,
			fetchChats: fetchChatsStable,
			fetchGroups: fetchGroupsStable,
			contacts,
			getUserInfo,
		}),
		[
			uiState,
			messagesByChat,
			chats,
			groups,
			isLoading,
			currentUser,
			setActiveChatId,
			setActiveGroupId,
			toggleRightSidebar,
			setAnimatingIn,
			addMessage,
			setMessagesForChat,
			updateMessageStatus,
			updateMessageId,
			editMessage,
			markChatAsLoaded,
			upsertUser,
			fetchChatsStable,
			fetchGroupsStable,
			contacts,
			getUserInfo,
		],
	);

	return (
		<MessengerContext.Provider value={value}>
			{children}
		</MessengerContext.Provider>
	);
}

export function useMessengerState() {
	const context = useContext(MessengerContext);
	if (!context) {
		throw new Error("useMessengerState must be used within MessengerProvider");
	}
	return context;
}
