"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { createMediaUrl } from "./helper";
import type { User } from "./messengerTypes";

export interface ContactInfo {
	user_id: number;
	username: string;
	avatar: string;
	status: string;
	last_seen: number;
	created_at: number;
	trust_level: number;
}

export const getStatusColor = (status?: string) => {
	switch (status?.toLowerCase()) {
		case "online":
			return "success" as const;
		case "away":
			return "warning" as const;
		case "busy":
			return "danger" as const;
		case "offline":
			return "default" as const;
		default:
			return "default" as const;
	}
};

export const handleStatusChange = async (
	currentUser: User,
	upsertUser: (user: User) => void,
	status: string,
) => {
	try {
		await invoke("set_user_status", { status });
		if (currentUser) {
			upsertUser({ ...currentUser, status });
		}
		currentUser.status = status;
	} catch (err) {
		console.error("Failed to update status:", err);
	}
};

export function useContacts() {
	const [contacts, setContacts] = useState<Record<string, User>>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchContacts = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await invoke<any[]>("get_contacts");
			await invoke("subscribe_to_users", {
				userIds: result.map((c) => c.user_id),
			});
			setContacts((prev) => {
				const merged = { ...prev };
				result.forEach((c) => {
					const id = String(c.user_id);
					merged[id] = {
						...(prev[id] || {}),
						id,
						name: c.username,
						avatar: c.avatar,
						status: prev[id]?.status || c.status,
					};
				});
				return merged;
			});
		} catch (err) {
			console.error("Failed to fetch contacts:", err);
			setError(err instanceof Error ? err.message : "Failed to fetch contacts");
		} finally {
			setLoading(false);
		}
	}, []);

	const getUserInfo = useCallback(async (userId: string | number) => {
		try {
			const result = await invoke<any>("get_user_info", {
				userId: Number(userId),
			});
			const contact: User = {
				id: String(result.user_id),
				name: result.username,
				avatar: createMediaUrl(result.avatar),
				status: result.status,
			};
			return contact;
		} catch (err) {
			console.error(`Failed to fetch user info for ${userId}:`, err);
			return null;
		}
	}, []);

	const addContact = useCallback(
		async (userId: string | number) => {
			try {
				// Try to invoke backend if it exists, otherwise just fetch info
				try {
					await invoke("add_contact", { userId: Number(userId) });
				} catch (e) {
					console.warn(
						"Backend add_contact might not be implemented yet. Proceeding to get user info.",
					);
				}
				const info = await getUserInfo(userId);
				if (info) {
					setContacts((prev) => ({ ...prev, [info.id]: info }));
					return info;
				}
				throw new Error("Could not find user info");
			} catch (err) {
				console.error(`Failed to add contact ${userId}:`, err);
				throw err;
			}
		},
		[getUserInfo],
	);

	const manageTrustFactor = useCallback(
		async (userId: string | number, trustLevel: number) => {
			console.log(
				`Demo: Managing trust factor for ${userId} to level ${trustLevel}`,
			);
			try {
				// Demo invocation
				await invoke("update_trust_factor", {
					userId: Number(userId),
					trustLevel,
				});
			} catch (e) {
				console.warn(
					"Backend update_trust_factor might not be implemented yet. This is a demo function.",
				);
			}
			// In a real app, you might update the local state with the new trust factor here
			return true;
		},
		[],
	);

	useEffect(() => {
		fetchContacts();
	}, [fetchContacts]);

	return {
		contacts,
		setContacts,
		loading,
		error,
		getUserInfo,
		addContact,
		manageTrustFactor,
		refresh: fetchContacts,
	};
}
