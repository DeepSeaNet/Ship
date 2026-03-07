import { useEffect, useRef } from "react";
import { useMessengerState } from "../../../hooks/useMessengerState";
import type { MediaTrackInfo } from "../../../hooks/voice/types/mediasoup";
import { ParticipantTile } from "./ParticipantTile";

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
	participants: Record<string, string>;
}

/** Returns the right Tailwind grid-cols class for N participants */
function gridColsClass(count: number): string {
	if (count === 1) return "grid-cols-1";
	if (count <= 4) return "grid-cols-2";
	if (count <= 9) return "grid-cols-3";
	return "grid-cols-4";
}

/** Deduplicate remote participants and map video/audio tracks per participant */
function groupRemoteParticipants(tracks: MediaTrackInfo[]) {
	const map = new Map<
		string,
		{ videoTrack?: MediaTrackInfo; hasAudio: boolean }
	>();
	for (const track of tracks) {
		const pid = track.participantId ?? track.id;
		const entry = map.get(pid) ?? { hasAudio: false };
		if (track.type === "video") entry.videoTrack = track;
		if (track.type === "audio") entry.hasAudio = true;
		map.set(pid, entry);
	}
	return map;
}

export function ParticipantGrid({
	localUser,
	remoteTracks,
	participants = {},
}: ParticipantGridProps) {
	const { users } = useMessengerState();
	const remoteParticipants = groupRemoteParticipants(remoteTracks);
	const totalCount = 1 + remoteParticipants.size;
	const colsClass = gridColsClass(totalCount);

	const localVideoTrack: MediaTrackInfo | undefined =
		localUser.isVideoEnabled && localUser.localVideoStream
			? {
					id: "local-video",
					type: "video",
					participantId: localUser.id,
					mediaStreamTrack: localUser.localVideoStream.getVideoTracks()[0],
					sourceType: "camera",
				}
			: undefined;

	return (
		<div className={`grid ${colsClass} gap-2 w-full h-full p-2 auto-rows-fr`}>
			{/* ── Local tile ── */}
			<ParticipantTile
				participantId={localUser.id}
				name={localUser.name}
				avatar={localUser.avatar}
				isLocal
				isMuted={localUser.isMuted}
				hasVideo={!!localVideoTrack}
				videoTrack={localVideoTrack}
			/>

			{/* ── Remote tiles ── */}
			{[...remoteParticipants.entries()].map(([pid, { videoTrack }]) => {
				const userId = participants[pid];
				const user = userId ? users[userId] : null;
				const name = user?.name || `User ${pid.slice(0, 6)}`;
				const avatar = user?.avatar;

				return (
					<ParticipantTile
						key={pid}
						participantId={pid}
						name={name}
						avatar={avatar}
						hasVideo={!!videoTrack?.mediaStreamTrack}
						videoTrack={videoTrack}
					/>
				);
			})}
		</div>
	);
}

/** Hidden audio elements for all remote audio tracks */
export function RemoteAudioTracks({ tracks }: { tracks: MediaTrackInfo[] }) {
	return (
		<>
			{tracks
				.filter((t) => t.type === "audio" && t.mediaStreamTrack)
				.map((track) => (
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
