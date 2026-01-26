// Global UI State Types
export interface Permissions {
  manage_members: boolean;
  send_messages: boolean;
  delete_messages: boolean;
  rename_group: boolean;
  manage_permissions: boolean;
  pin_messages: boolean;
  manage_admins: boolean;
}

export interface GroupConfig {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  visibility: 'Public' | 'Private';
  join_mode: 'InviteOnly' | 'LinkOnly' | 'Open' | 'RequestToJoin';
  invite_link?: string;
  max_members?: number;
  creator_id: number;
  members: number[];
  admins: number[];
  permissions: Record<number, Permissions>;
  default_permissions: Permissions;
  banned: number[];
  muted: Record<number, string>;
  description?: string;
  avatar?: string;
  banner?: string;
  pinned_message_id?: number;
  slow_mode_delay?: number;
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
  participants?: number[];
  description?: string;
  owner_id?: number;
  admins?: number[];
  members?: number[];
  group_config?: GroupConfig;
  user_permissions?: Permissions;
  users_permissions?: Record<number, Permissions>;
  default_permissions?: Permissions;
  loaded?: boolean;
}

// Group is an alias for Chat when isGroup is true
export type Group = Chat;

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  status?: 'sending' | 'sent' | 'read' | 'error';
  media_name?: string;
  media?: string; // URL or base64
  media_id?: string;
  media_data?: string;
  reply_to?: string;
  edited?: boolean;
  expires?: number;
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
  users: Record<string, User>;
  setActiveChatId: (id: string) => void;
  setActiveGroupId: (id: string | null) => void;
  toggleRightSidebar: () => void;
  setAnimatingIn: (animating: boolean) => void;
  addMessage: (chatId: string, message: Message) => void;
  setMessagesForChat: (chatId: string, messages: Message[]) => void;
  updateMessageStatus: (chatId: string, messageId: string, status: Message['status']) => void;
  markChatAsLoaded: (chatId: string) => void;
  upsertUser: (user: User) => void;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  status?: string;
}

export interface Member extends User {
  role?: 'owner' | 'admin' | 'member';
}

export interface MediaItem {
  id: string;
  type: 'photo' | 'video' | 'audio' | 'document';
  url?: string;
  name?: string;
  size?: string;
  timestamp?: string;
}

export interface GroupInfo {
  chatId: string;
  photos: MediaItem[];
  audio: MediaItem[];
  videos: MediaItem[];
  documents: MediaItem[];
  members: Member[];
}
