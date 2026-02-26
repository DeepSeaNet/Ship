import { Button, Chip, Tooltip } from '@heroui/react';
import { MdClose, MdContentCopy, MdCheck } from 'react-icons/md';
import { HiMiniVideoCamera, HiMiniMicrophone } from 'react-icons/hi2';
import { useState } from 'react';
import { MediaTrackInfo } from './types';

interface InfoPanelProps {
    sessionId: string | null;
    status: string;
    localUserId: string;
    remoteTracks: MediaTrackInfo[];
    onClose: () => void;
}

export function InfoPanel({ sessionId, status, localUserId, remoteTracks, onClose }: InfoPanelProps) {
    const [copied, setCopied] = useState(false);

    const copySessionId = () => {
        if (!sessionId) return;
        navigator.clipboard.writeText(sessionId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const remoteParticipantIds = [
        ...new Set(remoteTracks.map(t => t.participantId).filter(Boolean) as string[]),
    ];
    const allParticipants = [localUserId, ...remoteParticipantIds];
    const videoTracks = remoteTracks.filter(t => t.type === 'video');
    const audioTracks = remoteTracks.filter(t => t.type === 'audio');

    const statusColors: Record<string, string> = {
        connected: 'bg-green-500/15 text-green-400 border-green-500/30',
        calling:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        error:     'bg-red-500/15 text-red-400 border-red-500/30',
        idle:      'bg-white/10 text-neutral-400 border-white/10',
    };

    return (
        <div className="flex flex-col h-full bg-neutral-900 border-l border-white/10 text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <span className="text-white font-semibold text-base tracking-tight">Call Info</span>
                <Button
                    isIconOnly size="sm" variant="ghost"
                    className="text-neutral-500 hover:text-white w-8 h-8 min-w-0 rounded-lg"
                    onPress={onClose}
                >
                    <MdClose size={17} />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* ── Voice ID ── */}
                <section>
                    <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">Voice ID</p>
                    {sessionId ? (
                        <Tooltip content={copied ? 'Copied!' : 'Click to copy'}>
                            <button
                                onClick={copySessionId}
                                className="w-full flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 transition-colors group text-left"
                            >
                                <span className="text-white font-mono text-[11px] truncate flex-1 leading-relaxed">
                                    {sessionId}
                                </span>
                                <span className="text-neutral-500 group-hover:text-white transition-colors shrink-0">
                                    {copied ? <MdCheck size={14} className="text-green-400" /> : <MdContentCopy size={14} />}
                                </span>
                            </button>
                        </Tooltip>
                    ) : (
                        <p className="text-neutral-600 text-xs">Not connected</p>
                    )}
                </section>

                {/* ── Status ── */}
                <section>
                    <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">Status</p>
                    <Chip
                        size="sm"
                        className={`font-semibold capitalize border ${statusColors[status] ?? statusColors.idle}`}
                    >
                        {status}
                    </Chip>
                </section>

                {/* ── Members ── */}
                <section>
                    <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">
                        Members ({allParticipants.length})
                    </p>
                    <div className="space-y-1.5">
                        {allParticipants.map(pid => {
                            const isLocal = pid === localUserId;
                            const hasVid = videoTracks.some(t => t.participantId === pid);
                            const hasAud = isLocal || audioTracks.some(t => t.participantId === pid);
                            return (
                                <div
                                    key={pid}
                                    className="flex items-center justify-between bg-white/5 hover:bg-white/8 border border-white/5 rounded-xl px-3 py-2 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                        <span className="text-white text-[11px] font-mono truncate">
                                            {isLocal ? `${pid.slice(0, 8)}… (You)` : `${pid.slice(0, 8)}…`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {hasVid && (
                                            <span title="Video" className="bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5 text-[9px] font-semibold flex items-center gap-0.5">
                                                <HiMiniVideoCamera size={9} /> VID
                                            </span>
                                        )}
                                        {hasAud && (
                                            <span title="Audio" className="bg-green-500/20 text-green-400 border border-green-500/20 rounded px-1.5 py-0.5 text-[9px] font-semibold flex items-center gap-0.5">
                                                <HiMiniMicrophone size={9} /> AUD
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ── Active Tracks ── */}
                <section>
                    <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">
                        Tracks ({remoteTracks.length})
                    </p>
                    {remoteTracks.length === 0 ? (
                        <p className="text-neutral-600 text-xs">No remote tracks</p>
                    ) : (
                        <div className="space-y-1.5">
                            {remoteTracks.map(track => (
                                <div
                                    key={track.id}
                                    className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="text-white text-[10px] font-mono truncate">
                                            {track.id.slice(0, 14)}…
                                        </p>
                                        <p className="text-neutral-500 text-[10px] mt-0.5">
                                            {track.participantId?.slice(0, 8)} · {track.sourceType}
                                        </p>
                                    </div>
                                    <Chip
                                        size="sm"
                                        className={`text-[9px] h-5 px-2 font-semibold border ${
                                            track.type === 'video'
                                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                                                : 'bg-green-500/15 text-green-400 border-green-500/20'
                                        }`}
                                    >
                                        {track.type.toUpperCase()}
                                    </Chip>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
