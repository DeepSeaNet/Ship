"use client";

import { useCallback, useState } from "react";

export interface ChatNotificationSettings {
	muted: boolean;
	mentionsOnly: boolean;
	muteUntil?: string; // ISO date string
}

export interface NotificationSettings {
	/** Show toast popups for incoming messages */
	enableToasts: boolean;
	/** Play a sound when a message arrives */
	enableSound: boolean;
	/** Show toasts for group messages */
	groupMessages: boolean;
	/** Show toasts for direct messages */
	directMessages: boolean;
	/** Show toasts only when a @mention is detected */
	mentionsOnly: boolean;
	/** Suppress all notifications (master mute) */
	doNotDisturb: boolean;
	/** Per-chat overrides */
	chatOverrides: Record<string, ChatNotificationSettings>;
}

const STORAGE_KEY = "notificationSettings";

const defaults: NotificationSettings = {
	enableToasts: true,
	enableSound: false,
	groupMessages: true,
	directMessages: true,
	mentionsOnly: false,
	doNotDisturb: false,
	chatOverrides: {},
};

function load(): NotificationSettings {
	if (typeof window === "undefined") return defaults;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaults;
		return { ...defaults, ...JSON.parse(raw) };
	} catch {
		return defaults;
	}
}

function save(settings: NotificationSettings) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useNotificationSettings() {
	const [settings, setSettingsState] = useState<NotificationSettings>(load);

	const updateSetting = useCallback(
		<K extends keyof NotificationSettings>(
			key: K,
			value: NotificationSettings[K],
		) => {
			setSettingsState((prev) => {
				const next = { ...prev, [key]: value };
				save(next);
				return next;
			});
		},
		[],
	);

	const updateChatSetting = useCallback(
		<K extends keyof ChatNotificationSettings>(
			chatId: string,
			key: K,
			value: ChatNotificationSettings[K],
		) => {
			setSettingsState((prev) => {
				const current = prev.chatOverrides[chatId] || {
					muted: false,
					mentionsOnly: false,
				};
				const next = {
					...prev,
					chatOverrides: {
						...prev.chatOverrides,
						[chatId]: { ...current, [key]: value },
					},
				};
				save(next);
				return next;
			});
		},
		[],
	);

	const resetChatSettings = useCallback((chatId: string) => {
		setSettingsState((prev) => {
			const { [chatId]: _, ...nextOverrides } = prev.chatOverrides;

			const next = { ...prev, chatOverrides: nextOverrides };
			save(next);

			return next;
		});
	}, []);

	const resetSettings = useCallback(() => {
		save(defaults);
		setSettingsState(defaults);
	}, []);

	return {
		settings,
		updateSetting,
		updateChatSetting,
		resetChatSettings,
		resetSettings,
	};
}

/** Read-only snapshot used inside listeners / non-React contexts */
export function getNotificationSettings(): NotificationSettings {
	return load();
}
