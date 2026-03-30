"use client";

import { toast } from "@heroui/react";
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
import type {
	Chat,
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
	const {
		contacts,
		setContacts,
		getUserInfo,
		manageTrustFactor,
		addContact,
		error: contactsError,
		loading: contactsLoading,
	} = useContacts();
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
			/*
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
			*/
			// Combine and sort
			const allChats = [...formattedGroups].sort((a, b) => {
				const aTime = a.lastMessageTime
					? new Date(a.lastMessageTime).getTime()
					: 0;
				const bTime = b.lastMessageTime
					? new Date(b.lastMessageTime).getTime()
					: 0;
				return bTime - aTime;
			});

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
	const setActiveChatId = useCallback((id: string | null) => {
		const isGroup = chatsRef.current.find((c) => c.id === id)?.isGroup || false;
		console.log("Setting active chat to:", id, "isGroup:", isGroup);
		setUIState((prev) => ({
			...prev,
			activeChatId: id,
			activeGroupId: isGroup ? id : null,
		}));
	}, []);

	const setActiveGroupId = useCallback(
		(id: string | null) => {
			setActiveChatId(id);
		},
		[setActiveChatId],
	);

	const toggleRightSidebar = useCallback(() => {
		setUIState((prev) => ({
			...prev,
			rightSidebarOpen: !prev.rightSidebarOpen,
		}));
	}, []);

	const setAnimatingIn = useCallback((animating: boolean) => {
		setUIState((prev) => ({
			...prev,
			isAnimatingIn: animating,
		}));
	}, []);

	const addMessage = useCallback((chatId: string, message: Message) => {
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
							lastMessageTime: message.timestamp || new Date().toISOString(),
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
	}, []);

	const setMessagesForChat = useCallback(
		(chatId: string, messages: Message[]) => {
			setMessagesByChat((prev) => ({
				...prev,
				[chatId]: messages,
			}));
		},
		[],
	);

	const updateMessageStatus = useCallback(
		(chatId: string, messageId: string, status: Message["status"]) => {
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
		},
		[],
	);

	const updateMessageId = useCallback(
		(chatId: string, oldId: string, newId: string) => {
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
		},
		[],
	);

	const editMessage = useCallback(
		(chatId: string, messageId: string, newContent: string) => {
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
		},
		[],
	);

	const markChatAsLoaded = useCallback((chatId: string) => {
		setUIState((prev) => {
			if (prev.loadedChatIds.includes(chatId)) return prev;
			return {
				...prev,
				loadedChatIds: [...prev.loadedChatIds, chatId],
			};
		});
	}, []);

	const upsertUser = useCallback(
		(user: Partial<User> & { id: string }) => {
			setContacts((prev) => {
				const existing = prev[user.id] || {};
				return {
					...prev,
					[user.id]: {
						...existing,
						...user,
						id: user.id,
						name: user.name || existing.name || `User ${user.id}`,
						status: user.status || existing.status,
					},
				};
			});
		},
		[setContacts],
	);

	// --- Current User Initialization ---
	useEffect(() => {
		const userId = localStorage.getItem("userId");
		const username = localStorage.getItem("username");
		const avatar_url = localStorage.getItem("avatarUrl") || "";
		if (userId && username) {
			const userData: User = {
				id: userId,
				name: username,
				status: "Online",
				avatar: avatar_url,
			};
			setCurrentUser(userData);
			upsertUser(userData);
		}
	}, [upsertUser]);

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
			editMessage,
			updateMessageStatus,
			updateMessageId,
			upsertUser,
			setGroups,
			// setIsLoading, setCurrentUser, setGroups, setChats, setUIState are from useState/useGroups and are stable
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
			manageTrustFactor,
			addContact,
			contactsError,
			contactsLoading,
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
			manageTrustFactor,
			addContact,
			contactsError,
			contactsLoading,
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
