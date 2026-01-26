import { useState, useEffect } from 'react';
import { GroupInfo } from './messengerTypes';
import { MOCK_GROUP_INFO } from './mock_data';

export function useGroupInfo(chatId: string | null) {
    const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chatId) {
            setGroupInfo(null);
            return;
        }

        setLoading(true);
        // Simulate API call
        const timer = setTimeout(() => {
            try {
                const info = MOCK_GROUP_INFO[chatId] || null;
                setGroupInfo(info);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch group info');
                setLoading(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [chatId]);

    return {
        groupInfo,
        loading,
        error,
    };
}
