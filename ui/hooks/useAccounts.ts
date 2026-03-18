import { invoke } from "@tauri-apps/api/core";
import type { Account } from "./types";
import { toast } from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

// Mock API functions - Replace with actual Tauri invoke calls
export const getAccountList = async (): Promise<Account[]> => {
	try {
		const accountList = (await invoke("get_account_list")) as Account[];
		return accountList;
	} catch (error) {
		console.error("Failed to load accounts:", error);
		throw error;
	}
};

export const loginWithAccount = async (
	account: Account,
	password?: string,
): Promise<void> => {
	try {
		try {
			const result = await invoke("login", { username: account.username });
		} catch (error) {
			console.error("Failed to login:", error);
			toast.danger("Failed to login: " + error);
			throw error;
		}
		localStorage.setItem("userId", account.user_id.toString());
		localStorage.setItem("username", account.username);
		localStorage.setItem("publicAddress", account.public_address);
		localStorage.setItem("serverAddress", account.server_address);
		localStorage.setItem("avatarUrl", account.avatar_url || "");
		//localStorage.setItem('serverPubKey', account.server_pub_key.toString())
	} catch (error) {
		console.error("Failed to login:", error);
		throw error;
	}
};

export const removeAccount = async (userId: number): Promise<void> => {
	try {
		// Replace this with: await invoke('remove_account', { user_id: userId })
		console.log("Removing account:", userId);
	} catch (error) {
		console.error("Failed to remove account:", error);
		throw error;
	}
};

export const getUserDevices = async (
	userId: number,
): Promise<{ device_id: string; created_at: number }[]> => {
	try {
		const devices = await invoke<{ device_id: string; created_at: number }[]>(
			"get_user_devices",
			{ user_id: userId },
		);
		console.log("User devices:", devices);
		return devices;
	} catch (error) {
		console.error("Failed to get user devices:", error);
		throw error;
	}
};

export const updateAvatar = async (
	croppedBytes?: Uint8Array,
	croppedDimensions?: { width: number; height: number },
	mimeType?: string,
): Promise<string> => {
	try {
		let bytes: Uint8Array;
		let dimensions: { width: number; height: number };

		if (croppedBytes && croppedDimensions) {
			bytes = croppedBytes;
			dimensions = croppedDimensions;
		} else {
			const selected = await open({
				filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif"] }],
				multiple: false,
			});

			if (!selected) return "";
			const path = Array.isArray(selected) ? selected[0] : selected;

			if (!mimeType) {
				const ext = path.split(".").pop()?.toLowerCase();
				if (ext === "png") mimeType = "image/png";
				else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
				else if (ext === "gif") mimeType = "image/gif";
				else if (ext === "webp") mimeType = "image/webp";
			}

			console.log("Selected avatar path:", path);

			// Read file bytes
			bytes = await readFile(path);
		}

		const fileSize = bytes.length;

		// Calculate hash
		const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
		const hash = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		if (!croppedDimensions) {
			// Get dimensions for chosen file
			dimensions = await new Promise<{ width: number; height: number }>(
				(resolve, reject) => {
					const img = new Image();
					const blob = new Blob([bytes]);
					img.src = URL.createObjectURL(blob);
					img.onload = () => {
						resolve({ width: img.width, height: img.height });
						URL.revokeObjectURL(img.src);
					};
					img.onerror = () =>
						reject(new Error("Failed to load image for dimensions"));
				},
			);
		} else {
			dimensions = croppedDimensions;
		}

		const response: { success: boolean; avatar_url: string } = await invoke(
			"update_avatar",
			{
				avatar: Array.from(bytes),
				avatarHash: hash,
				fileSize,
				mimeType: mimeType || "image/jpeg",
				width: dimensions.width,
				height: dimensions.height,
			},
		);

		toast("Avatar updated successfully", { variant: "success" });
		return response.avatar_url;
	} catch (error) {
		console.error("Failed to update avatar:", error);
		toast("Failed to update avatar: " + error, { variant: "danger" });
		throw error;
	}
};
