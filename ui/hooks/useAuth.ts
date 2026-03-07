import { invoke } from "@tauri-apps/api/core";
import type { LoginResult, RegisterResult } from "./types";

export const register = async (
	username: string,
	email: string,
	password: string,
) => {
	// Note: Backend currently takes (username, avatar_url).
	// We keep the signature as requested by the user.
	const result: RegisterResult = await invoke("register", {
		username,
		email,
		password,
	});

	return result;
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
