import { invoke } from "@tauri-apps/api/core";
import type { RegisterResult } from "./types";
import { toast } from "@heroui/react";

export const register = async (
	username: string,
	email: string,
	password: string,
) => {
	// Note: Backend currently takes (username, avatar_url).
	// We keep the signature as requested by the user.
	try {
		const result: RegisterResult = await invoke("register", {
			username,
			email,
			password,
		});
		toast.info(`Account registered successfully: ${result}`);
		return result;
	} catch (error) {
		console.error("Failed to register:", error);
		toast.danger(`Failed to register${error}`);
		throw error;
	}
};

export const import_account = async (
	import_data: string,
	import_key: string,
) => {
	const result: number = await invoke("import_account", {
		exportedAccount: import_data,
		key: import_key,
	});
	return result;
};
