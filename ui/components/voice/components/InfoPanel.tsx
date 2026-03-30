import { Avatar, Button, Chip, Tooltip } from "@heroui/react";
import { useState } from "react";
import { HiMiniMicrophone, HiMiniVideoCamera } from "react-icons/hi2";
import { MdCheck, MdClose, MdContentCopy } from "react-icons/md";
import { useMessengerState } from "../../../hooks/useMessengerState";
import type { MediaTrackInfo } from "../../../hooks/voice/types/mediasoup";

interface InfoPanelProps {
	sessionId: string | null;
	status: string;
	localUserId: string;
	remoteTracks: MediaTrackInfo[];
	participants: Record<string, string>;
	onClose: () => void;
}

export function InfoPanel({
	sessionId,
	status,
	localUserId,
	remoteTracks,
	participants = {},
	onClose,
}: InfoPanelProps) {
	const { contacts } = useMessengerState();
	const [copied, setCopied] = useState(false);

	const copySessionId = () => {
		if (!sessionId) return;
		navigator.clipboard.writeText(sessionId).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const remoteParticipantIds = [
		...new Set(
			remoteTracks.map((t) => t.participantId).filter(Boolean) as string[],
		),
	];
	const allParticipants = [localUserId, ...remoteParticipantIds];
	const videoTracks = remoteTracks.filter((t) => t.type === "video");
	const audioTracks = remoteTracks.filter((t) => t.type === "audio");

	const statusColors: Record<string, string> = {
		connected: "bg-green-500/15 text-green-400 border-green-500/30",
		calling: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
		error: "bg-red-500/15 text-red-400 border-red-500/30",
		idle: "bg-white/10 text-neutral-400 border-white/10",
	};

	return (
		<div className="flex flex-col h-full bg-surface border-l border-white/10 text-sm overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
				<span className="text-foreground font-semibold text-base tracking-tight">
					Call Info
				</span>
				<Button
					isIconOnly
					size="sm"
					variant="ghost"
					className="text-neutral-500 hover:text-white w-8 h-8 min-w-0 rounded-lg"
					onPress={onClose}
				>
					<MdClose size={17} />
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* ── Voice ID ── */}
				<section>
					<p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">
						Voice ID
					</p>
					{sessionId ? (
						<Tooltip delay={0}>
							<Button
								variant="ghost"
								onPress={copySessionId}
								className="w-full flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 transition-colors group text-left h-auto min-w-0"
							>
								<span className="text-accent font-mono text-[11px] truncate flex-1 leading-relaxed">
									{sessionId}
								</span>
								<span className="text-neutral-500 group-hover:text-white transition-colors shrink-0">
									{copied ? (
										<MdCheck size={14} className="text-green-400" />
									) : (
										<MdContentCopy size={14} />
									)}
								</span>
							</Button>
							<Tooltip.Content>
								{copied ? "Copied!" : "Click to copy"}
							</Tooltip.Content>
						</Tooltip>
					) : (
						<p className="text-neutral-600 text-xs">Not connected</p>
					)}
				</section>

				{/* ── Status ── */}
				<section>
					<p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">
						Status
					</p>
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
						{allParticipants.map((pid) => {
							const isLocal = pid === localUserId;
							const userId = isLocal ? pid : participants[pid];
							const user = userId ? contacts[userId] : null;
							const hasVid = videoTracks.some((t) => t.participantId === pid);
							const hasAud =
								isLocal || audioTracks.some((t) => t.participantId === pid);

							return (
								<div
									key={pid}
									className="flex items-center justify-between bg-white/5 hover:bg-white/8 border border-white/5 rounded-xl px-3 py-2 transition-colors"
								>
									<div className="flex items-center gap-2 min-w-0">
										<div className="relative shrink-0">
											<Avatar className="w-5 h-5 rounded-lg text-[10px]">
												{user?.avatar && <Avatar.Image src={user.avatar} />}
												<Avatar.Fallback>
													{user?.name
														? user.name.slice(0, 2).toUpperCase()
														: pid.slice(0, 2).toUpperCase()}
												</Avatar.Fallback>
											</Avatar>
											<span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#1a1a1b] bg-green-500" />
										</div>
										<div className="flex flex-col min-w-0">
											<span className="text-white text-[11px] font-medium truncate">
												{isLocal
													? `${user?.name || "You"} (Me)`
													: user?.name || `Peer ${pid.slice(0, 4)}…`}
											</span>
											<span className="text-neutral-500 text-[9px] font-mono leading-none">
												{pid.slice(0, 8)}…
											</span>
										</div>
									</div>
									<div className="flex items-center gap-1 shrink-0">
										{hasVid && (
											<Tooltip delay={0}>
												<span className="w-6 h-6 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg">
													<HiMiniVideoCamera size={13} />
												</span>
												<Tooltip.Content>Video active</Tooltip.Content>
											</Tooltip>
										)}
										{hasAud && (
											<Tooltip delay={0}>
												<span className="w-6 h-6 flex items-center justify-center bg-green-500/10 text-green-400 rounded-lg">
													<HiMiniMicrophone size={13} />
												</span>
												<Tooltip.Content>Audio active</Tooltip.Content>
											</Tooltip>
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
							{remoteTracks.map((track) => (
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
											track.type === "video"
												? "bg-blue-500/15 text-blue-400 border-blue-500/20"
												: "bg-green-500/15 text-green-400 border-green-500/20"
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
