import { useCallback, useEffect, useState } from "react";

export interface AppearanceSettings {
	/** Distance between message groups in pixels */
	messageSpacing: number;
	/** Message bubble font size in px */
	messageFontSize: number;
	/** Border radius preset for message bubbles */
	bubbleRadius: "sharp" | "rounded" | "pill";
	/** Show avatars next to messages */
	showAvatars: boolean;
	/** Compact mode - reduce all padding / element sizes */
	compactMode: boolean;
	/** UI scale percentage (80–120) */
	uiScale: number;
}

const DEFAULTS: AppearanceSettings = {
	messageSpacing: 4,
	messageFontSize: 14,
	bubbleRadius: "rounded",
	showAvatars: true,
	compactMode: false,
	uiScale: 100,
};

const STORAGE_KEY = "appearanceSettings";

function load(): AppearanceSettings {
	if (typeof window === "undefined") return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

function applyToDom(s: AppearanceSettings) {
	const root = document.documentElement;
	root.style.setProperty("--msg-spacing", `${s.messageSpacing}px`);
	root.style.setProperty("--msg-font-size", `${s.messageFontSize}px`);

	const radiusMap: Record<AppearanceSettings["bubbleRadius"], string> = {
		sharp: "4px",
		rounded: "18px",
		pill: "9999px",
	};
	root.style.setProperty("--bubble-radius", radiusMap[s.bubbleRadius]);
	root.dataset.compactMode = s.compactMode ? "true" : "false";

	const scale = s.uiScale / 100;
	root.style.setProperty("--ui-scale", scale.toString());
	root.style.fontSize = `${16 * scale}px`;
}

export function useAppearanceSettings() {
	const [settings, setSettings] = useState<AppearanceSettings>(load);

	useEffect(() => {
		applyToDom(settings);
	}, [settings]);

	const updateSetting = useCallback(
		<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
			setSettings((prev) => {
				const next = { ...prev, [key]: value };
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
				return next;
			});
		},
		[],
	);

	const resetSettings = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setSettings(DEFAULTS);
	}, []);

	return { settings, updateSetting, resetSettings };
}
