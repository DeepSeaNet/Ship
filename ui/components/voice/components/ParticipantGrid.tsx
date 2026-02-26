import { useRef, useEffect } from 'react';
import { ParticipantTile } from './ParticipantTile';
import { MediaTrackInfo } from '../../../hooks/voice/types/mediasoup';

export interface LocalUser {
    id: string;
    name: string;
    avatar?: string;
    isMuted: boolean;
    isVideoEnabled: boolean;
    localVideoStream: MediaStream | null;
}

interface ParticipantGridProps {
    localUser: LocalUser;
    remoteTracks: MediaTrackInfo[];
}

/** Returns the right Tailwind grid-cols class for N participants */
function gridColsClass(count: number): string {
    if (count === 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
}

/** Deduplicate remote participants and map video/audio tracks per participant */
function groupRemoteParticipants(tracks: MediaTrackInfo[]) {
    const map = new Map<string, { videoTrack?: MediaTrackInfo; hasAudio: boolean }>();
    for (const track of tracks) {
        const pid = track.participantId ?? track.id;
        const entry = map.get(pid) ?? { hasAudio: false };
        if (track.type === 'video') entry.videoTrack = track;
        if (track.type === 'audio') entry.hasAudio = true;
        map.set(pid, entry);
    }
    return map;
}

export function ParticipantGrid({ localUser, remoteTracks }: ParticipantGridProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Attach local video stream
    useEffect(() => {
        if (localVideoRef.current && localUser.localVideoStream) {
            localVideoRef.current.srcObject = localUser.localVideoStream;
        }
    }, [localUser.localVideoStream]);

    const remoteParticipants = groupRemoteParticipants(remoteTracks);
    const totalCount = 1 + remoteParticipants.size;
    const colsClass = gridColsClass(totalCount);

    return (
        <div className={`grid ${colsClass} gap-2 w-full h-full p-2 auto-rows-fr`}>
            {/* ── Local tile ── */}
            {localUser.isVideoEnabled && localUser.localVideoStream ? (
                <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{ aspectRatio: '16/9' }}
                >
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute bottom-2.5 left-2.5 z-10">
                        {localUser.isMuted && (
                            <span className="flex items-center justify-center bg-red-500/90 rounded-md p-1 mr-1.5 inline-flex">
                                <span className="text-white text-[10px]">🔇</span>
                            </span>
                        )}
                        <span className="bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-white/10">
                            {localUser.name} (You)
                        </span>
                    </div>
                </div>
            ) : (
                <ParticipantTile
                    participantId={localUser.id}
                    name={localUser.name}
                    avatar={localUser.avatar}
                    isLocal
                    isMuted={localUser.isMuted}
                    hasVideo={false}
                />
            )}

            {/* ── Remote tiles ── */}
            {[...remoteParticipants.entries()].map(([pid, { videoTrack }]) => (
                <ParticipantTile
                    key={pid}
                    participantId={pid}
                    name={`User ${pid.slice(0, 6)}`}
                    hasVideo={!!videoTrack?.mediaStreamTrack}
                    videoTrack={videoTrack}
                />
            ))}
        </div>
    );
}

/** Hidden audio elements for all remote audio tracks */
export function RemoteAudioTracks({ tracks }: { tracks: MediaTrackInfo[] }) {
    return (
        <>
            {tracks
                .filter(t => t.type === 'audio' && t.mediaStreamTrack)
                .map(track => (
                    <AudioTrack key={track.id} track={track} />
                ))}
        </>
    );
}

function AudioTrack({ track }: { track: MediaTrackInfo }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current && track.mediaStreamTrack) {
            ref.current.srcObject = new MediaStream([track.mediaStreamTrack]);
        }
    }, [track.mediaStreamTrack]);
    return <audio ref={ref} autoPlay className="hidden" />;
}
