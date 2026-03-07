# Messenger UI - Architecture & Implementation Guide

## 📋 Overview

Production-ready messenger UI built with HeroUI v3, featuring a complete authentication flow that transitions to a modern messenger interface with chat management, messaging, and user interaction features.

---

## 🏗️ Folder Structure

```
components/
├── auth/
│   ├── index.tsx                 # Main auth orchestrator (login/register/account-selection)
│   ├── LoginForm.tsx             # Login form with 3 methods (password, QR, Base64)
│   ├── RegisterForm.tsx          # Account creation form
│   ├── QRCodeModal.tsx           # QR scanning modal
│   ├── AccountSelection.tsx      # Account listbox selector
│   └── index.tsx                 # Exports all auth components
│
├── messenger/
│   ├── MainMenu.tsx              # Root messenger component with MessengerProvider
│   ├── TopBar.tsx                # Header with search, settings, logout
│   ├── LeftSidebar.tsx           # Chat list with scrollable UI
│   ├── ChatArea.tsx              # Main chat display area
│   ├── InputBar.tsx              # Message input with send button
│   ├── RightSidebar.tsx          # HeroUI Drawer with chat details
│   ├── ChatListItem.tsx          # Individual chat item component
│   ├── MessageItem.tsx           # Individual message bubble component
│   ├── messenger.css             # Layout and messenger animations
│   └── index.ts                  # Exports all messenger components
│
├── landscape/
│   ├── LandscapeBackground.tsx   # SVG landscape with zoom effects
│   ├── landscape-background.css  # Landscape animations
│   └── index.ts                  # Exports landscape component
│
├── AuthTransition.tsx            # Smooth fade/zoom animation from auth to messenger
└── auth-transition.css           # Transition animations

hooks/
├── useMessengerState.ts          # Global UI state (Context-based)
├── messengerTypes.ts             # TypeScript interfaces for messenger
├── useChats.ts                   # Fetch and manage chat list
├── useMessages.ts                # Fetch messages for active chat
├── useSendMessage.ts             # Send message logic
├── useAccountList.ts             # (Existing) Account management
├── useAccounts.ts                # (Existing) Account API calls
├── useSendMessage.ts             # (Existing) Custom auth hook
└── index.ts                      # Barrel exports

app/
└── page.tsx                      # Entry point (AuthPage component)

lib/
├── types.ts                      # Shared TypeScript types
└── utils.ts                      # Helper functions (future)
```

---

## 🔑 Global State Management

### MessengerContext (hooks/useMessengerState.ts)

Manages global UI state without Redux/Zustand using React Context:

```typescript
interface UIState {
  activeChatId: string | null;        // Currently selected chat
  activeGroupId: string | null;       // Currently selected group
  rightSidebarOpen: boolean;          // Right drawer visibility
  isAnimatingIn: boolean;             // Entrance animation flag
}
```

### Provider Pattern

```tsx
<MessengerProvider>
  <MainMenu />
</MessengerProvider>
```

---

## 📊 Data Flow Architecture

### 1. **Hook-Based API Calls**

All data fetching lives in `/hooks/` - NO direct API calls in components:

- `useChats()` - Returns `{ chats, loading, error, getChatById }`
- `useMessages(chatId)` - Returns `{ messages, loading, error }`
- `useSendMessage()` - Returns `{ sendMessage, sending, error }`

### 2. **Component Consumption**

Components consume hooks and global state:

```tsx
function ChatArea() {
  const { uiState } = useMessengerState();        // Global state
  const { getChatById } = useChats();             // Hook data
  const { messages } = useMessages(uiState.activeChatId);  // Chat messages

  // Render with data
}
```

### 3. **Mock Data**

For development/testing:
- `MOCK_CHATS` in `useChats.ts`
- `MOCK_MESSAGES_BY_CHAT` in `useMessages.ts`
- Easy to replace with real API calls

---

## 🎨 UI Components

### HeroUI v3 Components Used

| Component | Location | Purpose |
|-----------|----------|---------|
| `Card` | TopBar, ChatArea, RightSidebar | Container styling |
| `Button` | Entire app | Actions, interactions |
| `Input` | TopBar search, InputBar | User input |
| `Avatar` | ChatListItem, MessageItem | User avatars |
| `Badge` | ChatListItem | Unread message count |
| `Chip` | ChatArea, RightSidebar | Status badges |
| `Drawer` | RightSidebar | Slide-out details panel |
| `ListBox` | LeftSidebar | Chat list selection |
| `ScrollShadow` | LeftSidebar, ChatArea | Scrollable containers |
| `Spinner` | Loading states | Loading indicators |
| `Alert` | Auth success message | Notifications |

### Gravity UI Icons Used

- `MessageSquare`, `Plus` - Chat management
- `Settings`, `Info`, `LogOut` - Top bar actions
- `PaperPlane`, `PaperClip`, `Smile` - Message input
- `Check`, `CheckDouble` - Message status
- `Copy`, `Download`, `Share2` - Right sidebar actions

---

## 🎬 Animation & Transitions

### 1. **Post-Sign In Animation** (`AuthTransition.tsx`)

```typescript
// Smooth fade-out of login screen + zoom-in of messenger
@keyframes overlayFadeOut {
  from { opacity: 1; backdrop-filter: blur(10px); }
  to { opacity: 0; backdrop-filter: blur(0px); }
}

@keyframes messengerZoomIn {
  from { transform: scale(0.95) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
```

### 2. **Landscape Background** (Zoom on Tab Switch)

```typescript
// Login: Scale 1.6, translate left
// Register: Scale 1.5, translate right
```

### 3. **Messenger Entrance** (`messenger.css`)

```typescript
@keyframes messengerSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## 🔄 Authentication Flow

```
1. AuthPage Component Loads
   ↓
2. User Signs In or Selects Account
   ↓
3. Success Message + Landscape Zoom
   ↓
4. AuthTransition Component Triggers
   ├─ Overlay fades out (600ms)
   ├─ Messenger scales in (700ms)
   └─ Background landscape blur removes
   ↓
5. MainMenu Renders with Initial Chat List
   ├─ useChats() fetches chat list
   ├─ First chat auto-selected
   └─ Messenger state initialized
   ↓
6. User Interacts with Messenger
   ├─ Click chat → setActiveChatId()
   ├─ useMessages(chatId) fetches messages
   ├─ Compose & send → useSendMessage()
   └─ Right sidebar → toggleRightSidebar()
```

---

## 📱 Component Deep Dives

### TopBar Component

```tsx
// Features:
- App logo with gradient background
- Search bar (placeholder)
- Info button (toggles right sidebar)
- Settings button
- Logout button

// State consumption:
- useMessengerState() for toggleRightSidebar
```

### LeftSidebar Component

```tsx
// Features:
- Chat list with scrollable UI
- Unread badge on each chat
- Avatar + last message preview
- "Start new chat" button
- Loading and empty states

// State consumption:
- useChats() for chat list
- useMessengerState() for active chat highlighting & selection
```

### ChatArea Component

```tsx
// Features:
- Chat header with avatar, member count
- Scrollable message list
- Message items with timestamps & status
- Empty state when no chat selected

// State consumption:
- useMessengerState() for active chat
- useChats() to get chat metadata
- useMessages() to get chat messages
```

### InputBar Component

```tsx
// Features:
- Rich input with attachments
- Emoji picker button
- Send button with loading state
- Enter to send (Shift+Enter for newline)

// State consumption:
- useMessengerState() for active chat
- useSendMessage() for sending logic
```

### RightSidebar (Drawer) Component

```tsx
// Features:
- Chat info card with avatar
- Conversation stats
- Media & files grid
- Share/mute/block actions

// State consumption:
- useMessengerState() for sidebar visibility
- useChats() for active chat info
```

---

## 🚀 Key Implementation Details

### 1. No Props Drilling

✅ Global state via Context:
```tsx
// Instead of:
<ChatArea chat={chat} onSelect={fn} messages={msgs} />

// We use:
const { uiState, setActiveChatId } = useMessengerState();
const { messages } = useMessages(uiState.activeChatId);
```

### 2. Hook-Centric Architecture

✅ All data fetching in hooks:
```tsx
// Hooks handle:
- API calls
- Data transformation
- Caching/memoization
- Error handling

// Components only:
- Render UI
- Handle user interactions
- Consume hooks
```

### 3. Smooth Animations

✅ CSS-based animations:
- No inline styles
- Performant GPU-accelerated transforms
- Responsive breakpoints
- Dark mode support

### 4. Responsive Design

✅ Mobile-first approach:
```css
/* Base: mobile */
.messenger-layout { flex-direction: column; }

/* Tablet/Desktop */
@media (min-width: 768px) {
  .messenger-layout { flex-direction: row; }
}
```

---

## 🔌 Integration Points

### Replacing Mock Data with Real API

**Before:**
```tsx
const MOCK_CHATS = [...];
```

**After:**
```tsx
export function useChats() {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    // Replace setTimeout with actual API call:
    // const res = await fetch('/api/chats');
    // const data = await res.json();
    // setChats(data);
  }, []);

  return { chats, loading, error };
}
```

### API Endpoints Needed

```
GET  /api/chats                    # Chat list
GET  /api/chats/:id/messages       # Messages for chat
POST /api/messages                 # Send message
GET  /api/groups                   # Group list (future)
POST /api/groups                   # Create group (future)
```

---

## 📈 Scalability Improvements (Future)

1. **Message Virtualization** - For large chat histories
2. **Real-time Updates** - WebSocket integration
3. **Message Reactions** - Add emoji reactions
4. **Typing Indicators** - Show "typing..." status
5. **User Presence** - Online/offline status
6. **Search** - Full text search in messages
7. **File Uploads** - Media sharing
8. **Voice Messages** - Audio recording
9. **Video Calls** - Integration with call provider
10. **Encryption** - End-to-end message encryption

---

## ✅ Best Practices Implemented

- ✅ **Separation of Concerns** - Components, hooks, types in separate files
- ✅ **Type Safety** - Full TypeScript coverage
- ✅ **No Prop Drilling** - Context + hooks instead
- ✅ **Error Handling** - Loading/error states in hooks
- ✅ **Performance** - Memoization, efficient re-renders
- ✅ **Accessibility** - HeroUI components are a11y compliant
- ✅ **Dark Mode** - CSS variables support
- ✅ **Responsive** - Mobile-first responsive design
- ✅ **Documentation** - Clear code comments

---

## 🎯 Testing Strategy (Future)

```typescript
// Unit Tests (Jest)
- useChats() hook
- useMessages() hook
- useSendMessage() hook
- Message filtering/sorting logic

// Component Tests (React Testing Library)
- ChatListItem rendering
- Message sending flow
- Sidebar toggle

// E2E Tests (Cypress)
- Complete sign-in to messaging flow
- Chat selection and messaging
- Drawer interactions
```

---

## 📝 Example Usage

```tsx
// Complete example: User signs in and sees messenger

// 1. AuthPage shows login form
// 2. User submits credentials
// 3. handleLoginSubmit() triggers
// 4. Success message shown
// 5. AuthTransition component fades in
// 6. MainMenu renders with MessengerProvider
// 7. useChats() fetches chat list
// 8. LeftSidebar displays chats
// 9. User clicks chat
// 10. setActiveChatId() updates global state
// 11. useMessages() fetches messages
// 12. ChatArea displays chat history
// 13. User types message and sends
// 14. useSendMessage() processes message
// 15. Message appears in chat (optimistic update needed)
```

---

## 🛠️ Development Workflow

1. **Start Dev Server**
   ```bash
   pnpm dev
   ```

2. **Navigate to Auth Page**
   ```
   http://localhost:3000
   ```

3. **Sign In** (any credentials work with mock data)

4. **See Messenger UI** with smooth transition

5. **Test Features:**
   - Click different chats
   - Send messages
   - Toggle right sidebar
   - Test responsiveness

---

## 📞 Support & Questions

For implementation questions or modifications:

1. Check component structure in `components/messenger/`
2. Verify hook logic in `hooks/`
3. Review type definitions in `hooks/messengerTypes.ts`
4. Check global state in `hooks/useMessengerState.ts`

---

**Built with:** HeroUI v3 | Gravity UI Icons | React 19 | TypeScript | Tailwind CSS v4
