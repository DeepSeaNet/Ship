"use client";

import { useState, useEffect } from "react";
import { getAccountList } from "./useAccounts";
import type { Account } from "./types";

export const useAccountList = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        setError(null);
        const accountList = await getAccountList();
        setAccounts(accountList);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load accounts";
        setError(errorMessage);
        console.error("Failed to load accounts:", err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, []);

  return { accounts, loadingAccounts, error };
};
