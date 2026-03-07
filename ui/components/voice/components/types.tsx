export interface VoiceCallModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** When provided the call auto-starts and skips the join/create screen */
	chatName?: string;
	chatAvatar?: string;
}

const TILE_COLORS = [
	"#5865F2",
	"#57F287",
	"#FEE75C",
	"#EB459E",
	"#ED4245",
	"#3BA55D",
	"#FAA61A",
	"#9B59B6",
	"#1ABC9C",
	"#E91E63",
	"#2196F3",
	"#FF5722",
	"#607D8B",
	"#795548",
	"#009688",
	"#673AB7",
];

export function getTileColor(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = seed.charCodeAt(i) + ((hash << 5) - hash);
	}
	return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}
