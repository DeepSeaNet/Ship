import type { DateTime, JoinMode, Permissions, Visibility } from "./generated";

export interface GroupPermissions extends Permissions {
	allow_links: boolean;
	allow_stickers: boolean;
	allow_gifs: boolean;
	allow_voice_messages: boolean;
	allow_video_messages: boolean;
}

export interface GroupConfig {
	id: number;
	name: string;
	created_at: DateTime;
	updated_at: DateTime;

	visibility: Visibility;
	join_mode: JoinMode;
	invite_link?: string | null;
	max_members?: number | null;

	creator_id: string;
	members: string[];
	admins: string[];
	permissions: Record<string, Permissions>;
	default_permissions: Permissions;
	banned: string[];
	muted: Record<string, DateTime>;

	description?: string | null;
	pinned_message_id?: string | null;
	slow_mode_delay?: number | null;
	allow_stickers: boolean;
	allow_gifs: boolean;
	allow_voice_messages: boolean;
	allow_video_messages: boolean;
	allow_links: boolean;
}

// Basic Chat interface that can be a single user or a group
export interface Chat {
	id: string;
	name: string;
	lastMessage?: string;
	lastMessageTime?: string;
	avatar?: string;
	unreadCount: number;
	isGroup: boolean;
	group_config?: GroupConfig;
	loaded?: boolean;
}

// Group is an alias for Chat when isGroup is true
export type Group = Chat;

export interface Message {
	id: string;
	chatId: string;
	senderId: string;
	content: string;
	timestamp: string;
	isOwn: boolean;
	status?: "sending" | "sent" | "read" | "error";
	media_name?: string | null;
	media?: string | null; // URL or base64
	media_id?: string | null;
	media_data?: string | null;
	reply_to?: string | null;
	edited?: boolean;
	expires?: string | number | null;
	is_file?: boolean;
}

export interface UIState {
	activeChatId: string | null;
	activeGroupId: string | null;
	rightSidebarOpen: boolean;
	isAnimatingIn: boolean;
	loadedChatIds: string[];
}

export interface MessengerContextType {
	uiState: UIState;
	messagesByChat: Record<string, Message[]>;
	chats: Chat[];
	groups: Group[];
	contacts: Record<string, User>;
	isLoading: boolean;
	currentUser: User | null;

	// Actions
	setActiveChatId: (id: string | null) => void;
	setActiveGroupId: (id: string | null) => void;
	toggleRightSidebar: () => void;
	setAnimatingIn: (animating: boolean) => void;

	// Data Methods
	addMessage: (chatId: string, message: Message) => void;
	setMessagesForChat: (chatId: string, messages: Message[]) => void;
	updateMessageStatus: (
		chatId: string,
		messageId: string,
		status: Message["status"],
	) => void;
	updateMessageId: (chatId: string, oldId: string, newId: string) => void;
	editMessage: (chatId: string, messageId: string, newContent: string) => void;
	markChatAsLoaded: (chatId: string) => void;
	upsertUser: (user: Partial<User> & { id: string }) => void;
	getUserInfo: (userId: string | number) => Promise<User | null>;
	manageTrustFactor: (userId: string, factor: number) => Promise<boolean>;
	addContact: (userId: string) => Promise<User>;
	contactsError: string | null;
	contactsLoading: boolean;
	// Fetchers
	fetchChats: () => Promise<void>;
	fetchGroups: () => Promise<void>;
}

export interface User {
	id: string;
	name: string;
	avatar?: string;
	email?: string;
	status?: string;
}

export interface Member extends User {
	role?: "owner" | "admin" | "member";
}

export interface MediaItem {
	id: string;
	type: "photo" | "video" | "audio" | "document";
	url?: string;
	name?: string;
	size?: string;
	timestamp?: string;
}

export interface GroupInfo {
	chatId: string;
	name: string;
	description?: string;
	avatar?: string;
	photos: MediaItem[];
	audio: MediaItem[];
	videos: MediaItem[];
	documents: MediaItem[];
	members: Member[];
}

export interface TypingStatus {
	chatId: string;
	userId: string;
	isTyping: boolean;
	timestamp: number;
}
