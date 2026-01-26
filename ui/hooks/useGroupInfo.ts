import { useState, useEffect, useCallback } from 'react';
import { GroupInfo, MediaItem, Member } from './messengerTypes';
import { invoke } from '@tauri-apps/api/core';

const createMediaUrl = (mediaData: string | undefined): string | undefined => {
    if (!mediaData) return undefined;
    if (mediaData.startsWith('data:') || mediaData.startsWith('http')) return mediaData;
    return `data:image/png;base64,${mediaData}`;
};

export function useGroupInfo(chatId: string | null) {
    const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchGroupInfo = useCallback(async () => {
        if (!chatId) {
            setGroupInfo(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // In DeepSeaNet, group info can be derived from groups list if already loaded,
            // or we might need specific calls.
            const groups = await invoke<any[]>('get_groups');
            const group = groups.find(g => g.group_id === chatId);

            if (!group) {
                setError('Group not found');
                setLoading(false);
                return;
            }

            // Fetch media
            const mediaResponse = await invoke<any>('get_all_group_media', { groupName: chatId });
            const mediaList: any[] = mediaResponse.media || [];

            const photos: MediaItem[] = [];
            const audio: MediaItem[] = [];
            const videos: MediaItem[] = [];
            const documents: MediaItem[] = [];

            mediaList.forEach(m => {
                const item: MediaItem = {
                    id: m.media_id,
                    name: m.filename,
                    timestamp: new Date(m.timestamp * 1000).toISOString(),
                    type: 'document' // Default
                };

                const ext = m.filename.split('.').pop()?.toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    item.type = 'photo';
                    photos.push(item);
                } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                    item.type = 'audio';
                    audio.push(item);
                } else if (['mp4', 'mov', 'avi'].includes(ext)) {
                    item.type = 'video';
                    videos.push(item);
                } else {
                    documents.push(item);
                }
            });

            // Fetch members info
            const memberIds: number[] = group.members || [];
            const members: Member[] = await Promise.all(memberIds.map(async (id) => {
                try {
                    const info = await invoke<any>('get_user_info', { userId: id });
                    return {
                        id: id.toString(),
                        name: info.username || info.name || 'User ' + id,
                        email: info.email || '',
                        avatar: createMediaUrl(info.avatar),
                        role: group.admins?.includes(id) ? 'admin' : group.owner_id === id ? 'owner' : 'member'
                    } as Member;
                } catch (e) {
                    return { id: id.toString(), name: 'User ' + id, email: '' } as Member;
                }
            }));

            setGroupInfo({
                chatId,
                photos,
                audio,
                videos,
                documents,
                members
            });
        } catch (err) {
            console.error('Error fetching group info:', err);
            setError('Failed to fetch group info');
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    useEffect(() => {
        fetchGroupInfo();
    }, [fetchGroupInfo]);

    return {
        groupInfo,
        loading,
        error,
    };
}
