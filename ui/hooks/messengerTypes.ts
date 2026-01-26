// Global UI State Types
export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  avatar?: string;
  unreadCount: number;
  isGroup: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  avatar?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  status?: 'sending' | 'sent' | 'read';
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
  setActiveChatId: (id: string) => void;
  setActiveGroupId: (id: string | null) => void;
  toggleRightSidebar: () => void;
  setAnimatingIn: (animating: boolean) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessageStatus: (chatId: string, messageId: string, status: Message['status']) => void;
  markChatAsLoaded: (chatId: string) => void;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar?: string;
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
