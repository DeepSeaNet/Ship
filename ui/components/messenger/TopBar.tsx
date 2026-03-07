"use client";

import { CircleInfo, Ellipsis, Handset, Video } from "@gravity-ui/icons";
import { Avatar, Button } from "@heroui/react";
import { useState } from "react";
import { useChats } from "@/hooks/useChats";
import { useMessengerState } from "@/hooks/useMessengerState";
import { VoiceCallModal } from "../voice/VoiceCallModal";

interface TopBarProps {
	onInfoClick?: () => void;
}

export function TopBar({ onInfoClick }: TopBarProps) {
	const { uiState } = useMessengerState();
	const { getChatById } = useChats();
	const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
	const activeChat = uiState.activeChatId
		? getChatById(uiState.activeChatId)
		: null;

	const handleOpenCall = () => {
		setIsVoiceModalOpen(true);
	};

	const handleClose = () => {
		setIsVoiceModalOpen(false);
	};

	return (
		<div className="h-16 border-b border-border flex items-center px-6 justify-between bg-surface">
			{activeChat ? (
				<div className="flex items-center gap-3">
					<Avatar className="size-10 border border-border">
						{activeChat.avatar && (
							<Avatar.Image src={activeChat.avatar} alt={activeChat.name} />
						)}
						<Avatar.Fallback>
							{activeChat.name
								? activeChat.name.slice(0, 1).toUpperCase()
								: "?"}
						</Avatar.Fallback>
					</Avatar>
					<div>
						<h3 className="font-semibold text-sm text-accent">
							{activeChat.name}
						</h3>
						<p className="text-xs text-muted">
							{activeChat.isGroup
								? `${activeChat.members?.length || 0} members`
								: "Online"}
						</p>
					</div>
				</div>
			) : (
				<div className="text-muted text-sm">Select a conversation</div>
			)}

			<div className="flex items-center gap-1">
				<Button
					isIconOnly
					variant="ghost"
					size="sm"
					onPress={handleOpenCall}
					className="hover:bg-on-surface text-muted"
				>
					<Handset className="w-5 h-5" />
				</Button>
				<Button
					isIconOnly
					variant="ghost"
					size="sm"
					className="hover:bg-on-surface text-muted"
				>
					<Video className="w-5 h-5" />
				</Button>
				<Button
					isIconOnly
					variant="ghost"
					size="sm"
					onPress={onInfoClick}
					className="hover:bg-on-surface text-muted"
				>
					<CircleInfo className="w-5 h-5" />
				</Button>
				<Button
					isIconOnly
					variant="ghost"
					size="sm"
					className="hover:bg-on-surface text-muted"
				>
					<Ellipsis className="w-5 h-5" />
				</Button>
			</div>

			{isVoiceModalOpen && (
				<VoiceCallModal
					isOpen={isVoiceModalOpen}
					onClose={handleClose}
					chatName={activeChat ? activeChat.name : undefined}
					chatAvatar={activeChat ? activeChat.avatar : undefined}
				/>
			)}
		</div>
	);
}
