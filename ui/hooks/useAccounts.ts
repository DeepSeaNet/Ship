import { invoke } from "@tauri-apps/api/core";
import type { Account } from "./types";
import { toast } from "@heroui/react";

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
		// Replace this with: await invoke('login_account', { account, password })
		console.log(
			"Logging in with account:",
			account,
			"Password:",
			password ? "******" : "None",
		);
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
