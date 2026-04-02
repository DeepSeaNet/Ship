"use client";

import { useCallback, useEffect, useState } from "react";
import {
	getContacts,
	getUserInfo as getUserInfoCommand,
	setUserStatus,
	subscribeToUsers,
} from "./generated";
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
		await setUserStatus({ status });
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
			const result = await getContacts();
			await subscribeToUsers({
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
			const result = await getUserInfoCommand({ userId: Number(userId) });
			if (!result) {
				console.error(`Failed to fetch user info for ${userId}`);
				return null;
			}
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
			//try {
			// Demo invocation
			//await updateTrustFactor({ userId: Number(userId), trustLevel });
			//} catch (e) {
			//	console.error("Failed to update trust factor:", e);
			//}
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
