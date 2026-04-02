import { Avatar, Card, Chip } from "@heroui/react";
import { useEffect, useRef } from "react";
import { MdMicOff, MdScreenShare, MdVideocamOff } from "react-icons/md";
import type { MediaTrackInfo } from "../../../hooks/voice/types/mediasoup";
import { getTileColor } from "./types";

interface ParticipantTileProps {
	/** Stable unique id (participantId or 'local') */
	participantId: string;
	/** Display name shown in the name badge */
	name: string;
	/** Optional avatar URL */
	avatar?: string;
	isLocal?: boolean;
	isMuted?: boolean;
	hasVideo?: boolean;
	/** The video MediaTrackInfo to render (undefined = show avatar placeholder) */
	videoTrack?: MediaTrackInfo;
}

export function ParticipantTile({
	participantId,
	name,
	avatar,
	isLocal = false,
	isMuted = false,
	hasVideo = false,
	videoTrack,
}: ParticipantTileProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const bgColor = getTileColor(participantId);

	// Attach remote track stream to video element
	useEffect(() => {
		if (!videoRef.current || !videoTrack?.mediaStreamTrack) return;
		videoRef.current.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
	}, [videoTrack?.mediaStreamTrack]);

	const isScreenShare = videoTrack?.sourceType === "screen";
	const displayName = name.length > 18 ? `${name.slice(0, 16)}…` : name;

	return (
		<Card
			variant="tertiary"
			className="w-full h-full border-none shadow-lg relative flex items-center justify-center p-0"
			style={{ backgroundColor: bgColor, aspectRatio: "16/9" }}
		>
			{/* ── Video layer ── */}
			{hasVideo && videoTrack?.mediaStreamTrack ? (
				<video
					ref={videoRef}
					autoPlay
					muted={isLocal}
					playsInline
					className="absolute inset-0 w-full h-full object-cover rounded-[inherit]"
					style={isLocal ? { transform: "scaleX(-1)" } : undefined}
				/>
			) : (
				/* No video → centered avatar placeholder */
				<div className="flex flex-col items-center justify-center gap-3 w-full h-full">
					<Avatar className="w-20 h-20 text-2xl font-bold ring-4 ring-white/20 shadow-2xl">
						{avatar && <Avatar.Image src={avatar} alt={name} />}
						<Avatar.Fallback>
							{name
								.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase()}
						</Avatar.Fallback>
					</Avatar>
				</div>
			)}

			{/* ── Screen-share "Watch Stream" overlay ── */}
			{isScreenShare && (
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm z-20">
					<MdScreenShare className="text-white text-4xl" />
					<Chip className="bg-black/60 text-white border border-white/20 font-semibold px-4 h-9 cursor-pointer hover:bg-black/80 transition-colors">
						Watch Stream
					</Chip>
				</div>
			)}

			{/* ── Bottom-left: name badge ── */}
			<div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-30">
				{isMuted && (
					<span className="flex items-center justify-center bg-red-500/90 rounded-md p-1">
						<MdMicOff className="text-white text-xs" />
					</span>
				)}
				<span className="bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-white/10 max-w-[140px] truncate">
					{isLocal ? `${displayName} (You)` : displayName}
				</span>
			</div>

			{/* ── Top-right: video-off indicator ── */}
			{!hasVideo && !isLocal && (
				<div className="absolute top-3 right-3 z-30">
					<span className="flex items-center justify-center bg-black/50 border border-white/10 rounded-md p-1">
						<MdVideocamOff className="text-white/60 text-xs" />
					</span>
				</div>
			)}
		</Card>
	);
}
