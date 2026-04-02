"use client";

import {
	ChevronDown,
	ChevronRight,
	FileText,
	Gear,
	MusicNote,
	PersonPlus,
	Picture,
	Video,
	Xmark,
} from "@gravity-ui/icons";
import {
	Avatar,
	Badge,
	Button,
	ScrollShadow,
	Spinner,
	Tooltip,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { MediaItem } from "@/hooks/messengerTypes";
import { useChats } from "@/hooks/useChats";
import { getStatusColor } from "@/hooks/useContacts";
import { useGroups } from "@/hooks/useGroups";
import { useMessengerState } from "@/hooks/useMessengerState";
import { GroupSettingsModal } from "../settings/GroupSettingsModal";

interface RightSidebarProps {
	onClose?: () => void;
	onToggle?: () => void;
}

export function RightSidebar({ onClose, onToggle }: RightSidebarProps) {
	const { uiState, contacts, getUserInfo, upsertUser } = useMessengerState();
	const { getChatById } = useChats();
	const { getGroupMedia } = useGroups();
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [mediaLoading, setMediaLoading] = useState(false);
	const [groupMedia, setGroupMedia] = useState<{
		photos: MediaItem[];
		audio: MediaItem[];
		videos: MediaItem[];
		documents: MediaItem[];
	} | null>(null);

	const activeChat = uiState.activeChatId
		? getChatById(uiState.activeChatId)
		: null;

	// Section expansion state
	const [expandedSections, setExpandedSections] = useState({
		photos: false,
		audio: false,
		videos: false,
		documents: false,
		members: true,
	});

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	// Fetch media when active chat changes
	useEffect(() => {
		if (!activeChat?.isGroup) {
			setGroupMedia(null);
			return;
		}

		const fetchMedia = async () => {
			setMediaLoading(true);
			try {
				const mediaList = await getGroupMedia(activeChat.id);

				const photos: MediaItem[] = [];
				const audio: MediaItem[] = [];
				const videos: MediaItem[] = [];
				const documents: MediaItem[] = [];

				mediaList.forEach((m) => {
					const item: MediaItem = {
						id: m.media_id,
						name: m.filename,
						timestamp: new Date(m.timestamp * 1000).toISOString(),
						type: "document", // Default
					};

					const ext = m.filename.split(".").pop()?.toLowerCase();
					if (!ext) return;
					if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
						item.type = "photo";
						photos.push(item);
					} else if (["mp3", "wav", "ogg"].includes(ext)) {
						item.type = "audio";
						audio.push(item);
					} else if (["mp4", "mov", "avi"].includes(ext)) {
						item.type = "video";
						videos.push(item);
					} else {
						documents.push(item);
					}
				});

				setGroupMedia({ photos, audio, videos, documents });
			} catch (error) {
				console.error("Failed to fetch group media:", error);
				// Non-critical, just empty lists
				setGroupMedia({ photos: [], audio: [], videos: [], documents: [] });
			} finally {
				setMediaLoading(false);
			}
		};

		fetchMedia();
	}, [activeChat?.id, activeChat?.isGroup]);

	// Fetch missing users for this chat
	useEffect(() => {
		if (!activeChat?.group_config?.members) return;

		const fetchMissingUsers = async () => {
			const missingIds =
				activeChat.group_config?.members?.filter(
					(id) => !contacts[id.toString()],
				) || [];

			const users = await Promise.all(missingIds.map((id) => getUserInfo(id)));

			users.forEach((user) => {
				if (user) upsertUser(user);
			});
		};

		fetchMissingUsers();
	}, [activeChat?.group_config?.members]);

	if (!uiState.activeChatId) {
		return (
			<div className="w-96 bg-surface border-l border-border flex items-center justify-center">
				<p className="text-sm text-muted">Select a chat to view info</p>
			</div>
		);
	}

	if (!activeChat) {
		return (
			<div className="w-96 bg-surface border-l border-border flex items-center justify-center">
				<p className="text-sm text-muted">Chat not found</p>
			</div>
		);
	}

	const photosCount = groupMedia?.photos.length || 0;
	const audioCount = groupMedia?.audio.length || 0;
	const videosCount = groupMedia?.videos.length || 0;
	const documentsCount = groupMedia?.documents.length || 0;
	const membersCount = activeChat.group_config?.members?.length || 0;

	// Resolve members from IDs
	const memberList = (activeChat.group_config?.members || []).map((id) => {
		const idStr = id.toString();
		const user = contacts[idStr] || {
			id: idStr,
			name: `User ${idStr}`,
			status: "offline",
		};

		const role =
			activeChat.group_config?.creator_id === id
				? "owner"
				: activeChat.group_config?.admins?.includes(id)
					? "admin"
					: "member";
		return { ...user, role };
	});
	return (
		<div className="w-96 bg-surface flex flex-col h-full border-l border-border">
			<ScrollShadow className="flex-1 overflow-y-auto">
				<div className="p-6 space-y-6">
					{/* Header with Close and Expand Buttons */}
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-xl text-accent-surface">Info</h3>
						<div className="flex gap-1">
							<Tooltip delay={0}>
								<Button
									isIconOnly
									variant="tertiary"
									size="sm"
									onPress={onToggle}
									aria-label="Toggle Sidebar"
								>
									<ChevronRight className="w-5 h-5" />
								</Button>
								<Tooltip.Content>Toggle Sidebar</Tooltip.Content>
							</Tooltip>
							<Tooltip delay={0}>
								<Button
									isIconOnly
									variant="tertiary"
									size="sm"
									onPress={() => setIsSettingsOpen(true)}
									isDisabled={!activeChat.isGroup}
									aria-label="Settings"
								>
									<Gear className="w-5 h-5" />
								</Button>
								<Tooltip.Content>Settings</Tooltip.Content>
							</Tooltip>
							{onClose && (
								<Tooltip delay={0}>
									<Button
										isIconOnly
										variant="tertiary"
										size="sm"
										onPress={onClose}
										aria-label="Close"
									>
										<Xmark className="w-5 h-5" />
									</Button>
									<Tooltip.Content>Close</Tooltip.Content>
								</Tooltip>
							)}
						</div>
					</div>

					{/* Group Profile Section */}
					<div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-border">
						<Avatar
							size="lg"
							className="w-24 h-24 text-4xl shadow-lg border-4 border-surface"
						>
							{activeChat.avatar && (
								<Avatar.Image src={activeChat.avatar} alt={activeChat.name} />
							)}
							<Avatar.Fallback className="bg-gradient-to-br from-accent to-accent-surface text-accent-foreground">
								{activeChat.name.slice(0, 1).toUpperCase()}
							</Avatar.Fallback>
						</Avatar>
						<div className="space-y-1">
							<h2 className="text-2xl font-bold text-accent">
								{activeChat.name}
							</h2>
							<p className="text-sm text-muted line-clamp-3">
								{activeChat.group_config?.description ||
									"No description provided"}
							</p>
						</div>
						<div className="flex w-full gap-2">
							<Button className="flex-1" variant="secondary">
								Share Link
							</Button>
							<Button className="flex-1" variant="secondary">
								Search
							</Button>
						</div>
					</div>

					{/* Photos Section */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Picture className="w-5 h-5 text-muted" />
								<span className="text-sm font-medium text-accent">Photos</span>
								{mediaLoading ? (
									<Spinner size="sm" />
								) : (
									<span className="text-sm text-muted">• {photosCount}</span>
								)}
							</div>
							<Button
								isIconOnly
								variant="tertiary"
								size="sm"
								onPress={() => toggleSection("photos")}
							>
								<ChevronDown
									className={`w-5 h-5 transition-transform duration-200 ${
										expandedSections.photos ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						{expandedSections.photos &&
							(photosCount > 0 ? (
								<div className="grid grid-cols-4 gap-2 animate-in fade-in duration-200">
									{groupMedia?.photos.slice(0, 8).map((photo) => (
										<div
											key={photo.id}
											title={photo.name}
											className="aspect-square bg-neutral-800 rounded-xl hover:opacity-80 cursor-pointer border border-neutral-700 flex items-center justify-center overflow-hidden"
										>
											{/* We'd call get_group_media(photo.id) here if we wanted to show thumbnails */}
											<Picture className="w-4 h-4 text-neutral-600" />
										</div>
									))}
								</div>
							) : (
								<p className="text-xs text-muted px-8">No photos yet</p>
							))}
					</div>

					{/* Audio Section */}
					<div className="border-t border-border">
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<MusicNote className="w-5 h-5 text-muted" />
								<span className="text-sm font-medium text-accent">Audio</span>
								{mediaLoading ? (
									<Spinner size="sm" />
								) : (
									<span className="text-sm text-muted">• {audioCount}</span>
								)}
							</div>
							<Button
								isIconOnly
								variant="tertiary"
								size="sm"
								onPress={() => toggleSection("audio")}
							>
								<ChevronDown
									className={`w-5 h-5 transition-transform duration-200 ${
										expandedSections.audio ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						{expandedSections.audio &&
							(audioCount > 0 ? (
								<div className="space-y-2 animate-in fade-in duration-200">
									{groupMedia?.audio.slice(0, 3).map((a) => (
										<div
											key={a.id}
											className="text-xs text-accent truncate px-2 py-1 bg-on-surface rounded"
										>
											{a.name}
										</div>
									))}
								</div>
							) : (
								<p className="text-xs text-muted px-8">No audio files</p>
							))}
					</div>

					{/* Videos Section */}
					<div className="border-t border-border">
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Video className="w-5 h-5 text-muted" />
								<span className="text-sm font-medium text-accent">Videos</span>
								{mediaLoading ? (
									<Spinner size="sm" />
								) : (
									<span className="text-sm text-muted">• {videosCount}</span>
								)}
							</div>
							<Button
								isIconOnly
								variant="tertiary"
								size="sm"
								onPress={() => toggleSection("videos")}
							>
								<ChevronDown
									className={`w-5 h-5 transition-transform duration-200 ${
										expandedSections.videos ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						{expandedSections.videos &&
							(videosCount > 0 ? (
								<div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
									{groupMedia?.videos.slice(0, 2).map((v) => (
										<div
											key={v.id}
											className="aspect-video bg-neutral-800 rounded-lg flex items-center justify-center"
										>
											<Video className="w-6 h-6 text-neutral-600" />
										</div>
									))}
								</div>
							) : (
								<p className="text-xs text-muted px-8">No videos yet</p>
							))}
					</div>

					{/* Documents Section */}
					<div className="border-t border-border">
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<FileText className="w-5 h-5 text-muted" />
								<span className="text-sm font-medium text-accent">
									Documents
								</span>
								{mediaLoading ? (
									<Spinner size="sm" />
								) : (
									<span className="text-sm text-muted">• {documentsCount}</span>
								)}
							</div>
							<Button
								isIconOnly
								variant="tertiary"
								size="sm"
								onPress={() => toggleSection("documents")}
							>
								<ChevronDown
									className={`w-5 h-5 transition-transform duration-200 ${
										expandedSections.documents ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						{expandedSections.documents &&
							(documentsCount > 0 ? (
								<div className="space-y-2 animate-in fade-in duration-200">
									{groupMedia?.documents.slice(0, 5).map((doc) => (
										<div
											key={doc.id}
											className="flex items-center gap-2 p-2 rounded hover:bg-on-surface"
										>
											<FileText className="w-4 h-4 text-muted" />
											<span className="text-xs text-accent-surface truncate">
												{doc.name}
											</span>
										</div>
									))}
								</div>
							) : (
								<p className="text-xs text-muted px-8">No documents yet</p>
							))}
					</div>

					{/* Members Section */}
					<div className="space-y-3 pt-3 border-t border-border">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<PersonPlus className="w-5 h-5 text-muted" />
								<span className="text-sm font-medium text-accent">
									Members ({membersCount})
								</span>
							</div>
							<Button
								isIconOnly
								variant="tertiary"
								size="sm"
								onPress={() => toggleSection("members")}
							>
								<ChevronDown
									className={`w-5 h-5 transition-transform duration-200 ${
										expandedSections.members ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						{expandedSections.members && (
							<div className="space-y-3 animate-in fade-in duration-200">
								{memberList.map((member) => (
									<div key={member.id} className="flex items-center gap-3">
										<div className="relative">
											<Badge.Anchor>
												<Avatar size="md">
													{member.avatar && (
														<Avatar.Image
															src={member.avatar}
															alt={member.name}
														/>
													)}
													<Avatar.Fallback>
														{member.name.slice(0, 1).toUpperCase()}
													</Avatar.Fallback>
												</Avatar>
												<Badge
													color={getStatusColor(member.status)}
													placement="bottom-right"
													size="sm"
													variant="primary"
													className="border-2 border-surface"
												/>
											</Badge.Anchor>
											{member.role === "owner" && (
												<div
													className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-surface z-10"
													title="Owner"
												/>
											)}
											{member.role === "admin" && (
												<div
													className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-surface z-10"
													title="Admin"
												/>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-accent-surface truncate">
												{member.name}
											</p>
											<p className="text-xs text-muted truncate">
												{member.role?.toUpperCase() || "MEMBER"}
											</p>
										</div>
									</div>
								))}

								{membersCount > 5 && (
									<Button
										variant="ghost"
										size="sm"
										className="text-primary font-medium"
									>
										View All {membersCount} Members
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			</ScrollShadow>

			{activeChat?.isGroup && (
				<GroupSettingsModal
					isOpen={isSettingsOpen}
					onOpenChange={setIsSettingsOpen}
					group={activeChat}
				/>
			)}
		</div>
	);
}
