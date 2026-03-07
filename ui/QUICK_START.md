# 🚀 Messenger UI - Quick Start Guide

## Installation & Setup

### 1. Verify Dependencies

```bash
# All required packages should be installed:
pnpm install

# Key dependencies:
# - @heroui/react (v3 - UI components)
# - @gravity-ui/icons (icons)
# - react 19+
# - tailwind css v4
```

### 2. Start Development Server

```bash
pnpm dev
```

Then open: `http://localhost:3000`

---

## 🎯 Quick Test Flow

### 1. **Authentication Screen**
   - See landscape SVG background with zoom effects
   - Try switching between "Login" and "Create Account" tabs
   - Watch the background landscape zoom into different areas

### 2. **Sign In**
   - Use any email/password (mock credentials work)
   - Click "Sign In" button
   - Watch the smooth fade/zoom transition animation

### 3. **Messenger Interface**
   - Left sidebar shows chat list
   - Top bar has search, info, settings, logout
   - Main chat area in center
   - Message input at bottom
   - Right info drawer (click Info button in top bar)

### 4. **Chat Interactions**
   - Click different chats to see messages
   - Type message and press Enter or click send
   - Click the info icon to see chat details in drawer

---

## 📁 File Navigation

### For UI/Components
```
components/messenger/     ← All messenger UI components
components/auth/          ← Authentication components
components/landscape/     ← Background SVG
```

### For State & Data
```
hooks/useMessengerState.ts    ← Global UI state
hooks/useChats.ts             ← Chat list data
hooks/useMessages.ts          ← Message data
hooks/useSendMessage.ts       ← Send message logic
```

### For Styles
```
components/messenger/messenger.css       ← Layout & animations
components/landscape/landscape-background.css
components/auth-transition.css           ← Sign-in transition
```

---

## 🔧 Common Tasks

### Add a New Chat Feature

1. **Add to hook** (`hooks/useChats.ts`):
```typescript
export function useChats() {
  // Add your new feature logic here
}
```

2. **Use in component** (`components/messenger/LeftSidebar.tsx`):
```typescript
const { chats } = useChats();
// Use chats data here
```

### Update Message Display

Edit: `components/messenger/MessageItem.tsx`

### Change Colors/Styling

Edit: `components/messenger/messenger.css`

### Modify Global State

Edit: `hooks/useMessengerState.ts`

---

## 🎬 Animation Control

### Chat Transition
File: `components/messenger/messenger.css`
```css
@keyframes chatAreaFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
```

### Message Animation
File: `components/messenger/messenger.css`
```css
@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Sign-In Transition
File: `components/auth-transition.css`
```css
@keyframes messengerZoomIn {
  from { transform: scale(0.95) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
```

---

## 🎨 UI Component Reference

### HeroUI v3 Components in Use

**Containers:**
- `Card` - Content wrapper
- `ScrollShadow` - Scrollable area

**Forms/Input:**
- `Input` - Text input
- `Button` - All buttons
- `Checkbox` - Form checkboxes

**Data Display:**
- `Avatar` - User avatars
- `Badge` - Unread counts
- `Chip` - Status tags
- `ListBox` - Chat list selection

**Feedback:**
- `Spinner` - Loading state
- `Alert` - Messages
- `Drawer` - Side panel

---

## 🔐 Authentication Flow

```
User Login
    ↓
handleLoginSubmit()
    ↓
Show success message
    ↓
Trigger AuthTransition
    ↓
MainMenu Renders
    ↓
MessengerProvider initializes
    ↓
useChats() fetches data
    ↓
LeftSidebar shows chat list
```

---

## 📊 State Management Flow

```
Component
    ↓
useMessengerState() ← Global state
    ↓
Local state updates
    ↓
Re-render with new data
```

### Global State Values

```typescript
{
  activeChatId: string | null,      // Currently viewed chat
  activeGroupId: string | null,     // Currently viewed group
  rightSidebarOpen: boolean,        // Info drawer visibility
  isAnimatingIn: boolean            // Entrance animation
}
```

---

## 🐛 Debugging Tips

### Check Active Chat
```typescript
// In any component:
const { uiState } = useMessengerState();
console.log('Active chat:', uiState.activeChatId);
```

### View Mock Data
```typescript
// In browser console:
import { MOCK_CHATS } from '@/hooks/useChats'
console.log(MOCK_CHATS)
```

### Test Animations
```css
/* Temporarily disable animations for testing */
* { animation: none !important; transition: none !important; }
```

---

## 🚀 Performance Tips

1. **Virtualize Long Lists** - Use `react-virtual` for large chat histories
2. **Memoize Components** - Use `React.memo()` for list items
3. **Lazy Load Images** - Use `next/image` for avatars
4. **Debounce Search** - Search input with debounce delay
5. **Cache Messages** - Store fetched messages in hook state

---

## 🔗 API Integration

### When Ready to Connect Real Backend:

1. **Replace mock data in hooks:**
```typescript
// Before
const MOCK_CHATS = [...];

// After
const response = await fetch('/api/chats');
const data = await response.json();
```

2. **Add error boundaries:**
```typescript
try {
  // API call
} catch (error) {
  setError(error.message);
}
```

3. **Add retry logic:**
```typescript
const retry = () => refetch();
```

---

## 📱 Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

Edit breakpoints in: `components/messenger/messenger.css`

---

## ✨ Next Features to Add

- [ ] Typing indicators
- [ ] Message reactions
- [ ] Search functionality
- [ ] User presence (online/offline)
- [ ] Read receipts
- [ ] Message editing
- [ ] Message deletion
- [ ] Media uploads
- [ ] Emoji picker
- [ ] Voice messages

---

## 📚 Useful Links

- [HeroUI Documentation](https://heroui.com)
- [Gravity UI Icons](https://gravity-ui.com/icons)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 💡 Pro Tips

1. **Always consume hooks, never fetch data in components**
2. **Use global state for UI toggles, not data**
3. **Keep animations in CSS, not JS**
4. **Component files should focus on rendering only**
5. **Test with mock data before adding real API**

---

**Happy Coding! 🎉**
