// Main component — import this in your app
export { VoiceCallModal } from '../VoiceCallModal';

// Sub-components (exported for potential standalone reuse)
export { ParticipantTile } from './ParticipantTile';
export { ParticipantGrid } from './ParticipantGrid';
export { VoiceControlBar } from './VoiceControlBar';
export { InfoPanel } from './InfoPanel';
export { CallStatusBadge } from './CallStatusBadge';

// Types & utilities
export type { VoiceCallModalProps } from './types';
export { getTileColor } from './types';
