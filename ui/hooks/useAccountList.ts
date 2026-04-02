"use client";

import { useEffect, useState } from "react";
import type { AccountInfo } from "./generated";
import { getAccountList } from "./generated/commands";

export const useAccountList = () => {
	const [accounts, setAccounts] = useState<AccountInfo[]>([]);
	const [loadingAccounts, setLoadingAccounts] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadAccounts = async () => {
		try {
			setLoadingAccounts(true);
			setError(null);
			const accountList = await getAccountList();
			setAccounts(accountList);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Faile	d to load accounts";
			setError(errorMessage);
			console.error("Failed to load accounts:", err);
		} finally {
			setLoadingAccounts(false);
		}
	};

	useEffect(() => {
		loadAccounts();
	}, []);

	return { accounts, loadingAccounts, error, refreshAccounts: loadAccounts };
};
