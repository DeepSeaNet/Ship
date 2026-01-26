import type { Account } from "./types";
import { invoke } from '@tauri-apps/api/core'

// Mock API functions - Replace with actual Tauri invoke calls
export const getAccountList = async (): Promise<Account[]> => {
  try {
    const accountList = (await invoke('get_account_list')) as Account[]
    return accountList;
  } catch (error) {
    console.error("Failed to load accounts:", error);
    throw error;
  }
};

export const loginWithAccount = async (account: Account, password?: string): Promise<void> => {
  try {
    // Replace this with: await invoke('login_account', { account, password })
    console.log("Logging in with account:", account, "Password:", password ? "******" : "None");
    const result = await invoke('login', { username: account.username })
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
