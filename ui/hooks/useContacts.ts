'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from './messengerTypes';

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
      case 'online': return 'success' as const;
      case 'away': return 'warning' as const;
      case 'busy': return 'danger' as const;
      case 'offline': return 'default' as const;
      default: return 'default' as const;
    }
  };

export const handleStatusChange = async (currentUser: User, upsertUser: (user: User) => void, status: string) => {
    try {
      await invoke('set_user_status', { status });
      if (currentUser) {
        upsertUser({ ...currentUser, status });
      }
      currentUser.status = status;
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };
export function useContacts() {
    const [contacts, setContacts] = useState<ContactInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<ContactInfo[]>('get_contacts');
            await invoke('subscribe_to_users', { userIds: result.map(c => c.user_id ) }); 
            setContacts(result);
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    return {
        contacts,
        loading,
        error,
        refresh: fetchContacts,
    };
}
