// Helper for media URLs
export const createMediaUrl = (
	avatarData: string | undefined | null,
): string | undefined => {
	if (!avatarData) return undefined;
	if (avatarData.startsWith("data:") || avatarData.startsWith("http"))
		return avatarData;
	return `data:image/png;base64,${avatarData}`;
};

export const formatChatTime = (isoString?: string) => {
	if (!isoString) return "";
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) return isoString; // Return original string if invalid date

	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const dayMs = 24 * 60 * 60 * 1000;

	if (diff < dayMs && now.getDate() === date.getDate()) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	} else if (diff < dayMs * 7) {
		return date.toLocaleDateString([], { weekday: "short" });
	} else {
		return date.toLocaleDateString([], { month: "short", day: "numeric" });
	}
};
