"use client";
import { Check, CheckDouble, Clock, Folder } from "@gravity-ui/icons";
import { Avatar, Button, Card, Dropdown, Kbd, Label } from "@heroui/react";
import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import { formatChatTime } from "@/hooks/helper";
import type { Message } from "@/hooks/messengerTypes";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useMessengerState } from "@/hooks/useMessengerState";

interface MessageItemProps {
	message: Message;
	onReply?: (msg: Message) => void;
	onEdit?: (msg: Message) => void;
}

/** Render message content with @mention highlights */
function MentionText({
	content,
	ownUsername,
	isOwn,
}: {
	content: string;
	ownUsername: string;
	isOwn: boolean;
}) {
	const parts = content.split(/(@\S+)/g);
	return (
		<>
			{parts.map((part, i) => {
				const key = `${part}-${i}`;
				if (part.startsWith("@")) {
					const isOwnMention = ownUsername && part === `@${ownUsername}`;
					return (
						<span
							key={key}
							className={`font-semibold ${isOwnMention && !isOwn ? "bg-accent/20 text-accent rounded px-0.5" : !isOwn ? "text-accent" : "text-foreground"}`}
						>
							{part}
						</span>
					);
				}
				return <span key={key}>{part}</span>;
			})}
		</>
	);
}

/** Render file or image attachment */
function MediaPreview({
	message,
	isOwn,
}: {
	message: Message;
	isOwn: boolean;
}) {
	if (!message.media_name) return null;
	const fileName = message.media_name;
	const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

	if (isImage && message.media) {
		return (
			<div className="mb-2 max-w-full overflow-hidden rounded-xl bg-accent/5">
				<Image
					src={message.media}
					alt={fileName}
					width={300}
					height={300}
					className="max-h-[300px] w-full object-contain cursor-zoom-in rounded-xl"
				/>
			</div>
		);
	}

	return (
		<div
			className={`flex items-center gap-3 p-3 mb-2 rounded-xl border transition-colors ${
				isOwn
					? "bg-white/10 border-white/20 hover:bg-white/15"
					: "bg-accent/5 border-accent/20 hover:bg-accent/10"
			}`}
		>
			<div
				className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
					isOwn ? "bg-white/20 text-white" : "bg-accent/20 text-accent"
				}`}
			>
				<Folder className="w-5 h-5" />
			</div>
			<div className="flex-1 min-w-0">
				<p
					className={`text-sm font-semibold truncate ${
						isOwn ? "text-white" : "text-foreground"
					}`}
				>
					{fileName}
				</p>
				<p className="text-[10px] opacity-60">File Attachment</p>
			</div>
		</div>
	);
}

export function MessageItem({ message, onReply, onEdit }: MessageItemProps) {
	const isOwn = message.isOwn;
	const { messagesByChat, contacts } = useMessengerState();
	const ownUsername =
		typeof window !== "undefined" ? localStorage.getItem("username") || "" : "";

	const { actions, handleAction } = useMessageActions(message, {
		onReply,
		onEdit,
	});
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const user = contacts[message.senderId];

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		const menuWidth = 230;
		const menuHeight = 320; // Estimated height
		const x = Math.min(e.clientX, window.innerWidth - menuWidth);
		const y = Math.min(e.clientY, window.innerHeight - menuHeight);
		setPosition({ x: Math.max(0, x), y: Math.max(0, y) });
		setIsOpen(true);
	};

	// Resolve the message being replied to
	const chatMessages = messagesByChat[message.chatId] || [];
	const repliedMessage = message.reply_to
		? chatMessages.find((m) => String(m.id) === String(message.reply_to)) ||
			Object.values(messagesByChat)
				.flat()
				.find((m) => String(m.id) === String(message.reply_to))
		: null;

	const repliedUser = message.reply_to
		? contacts[repliedMessage?.senderId || ""]
		: null;

	const scrollToReplied = () => {
		if (!message.reply_to) return;
		const element = document.getElementById(`msg-${message.reply_to}`);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "center" });
			element.classList.add("ring-2", "ring-accent", "ring-offset-2");
			setTimeout(
				() =>
					element.classList.remove("ring-2", "ring-accent", "ring-offset-2"),
				2000,
			);
		}
	};

	return (
		<>
			<div
				id={`msg-${message.id}`}
				className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"} group hover:bg-neutral-800/5 rounded-lg p-1 transition-colors relative animate-in fade-in zoom-in-95 duration-500 ${isOwn ? "slide-in-from-right-8" : "slide-in-from-left-8"} fill-mode-both`}
				style={{ animationDelay: "40ms" }}
			>
				{!isOwn && (
					<Avatar size="sm" className="bg-default text-default-foreground mt-1">
						{user?.avatar && <Avatar.Image src={user.avatar} alt={user.name} />}
						<Avatar.Fallback>
							{user.name?.slice(0, 2).toUpperCase() || "??"}
						</Avatar.Fallback>
					</Avatar>
				)}

				<div
					className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[80%]`}
				>
					{!isOwn && (
						<p className="text-xs text-muted mb-1 px-1">
							{user.name || `User ${message.senderId}`}
						</p>
					)}

					<div
						className={`flex items-start gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
					>
						<Card
							onContextMenu={handleContextMenu}
							style={{
								borderRadius: "var(--bubble-radius, 18px)",
								fontSize: "var(--msg-font-size, 14px)",
							}}
							className={`px-3 py-1.5 ${
								isOwn
									? "bg-accent text-accent-foreground"
									: "bg-surface text-surface-foreground border border-border"
							} cursor-default min-w-[60px] max-w-full`}
						>
							{/* Reply-to preview */}
							{repliedMessage && repliedUser && (
								<Button
									variant="ghost"
									onPress={scrollToReplied}
									className={`h-auto rounded-lg text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity flex flex-col items-start w-full min-w-0 px-2 py-1 ${
										isOwn
											? "border-white/40 bg-white/10"
											: "border-accent bg-accent/10"
									}`}
								>
									<p
										className={`font-semibold ${isOwn ? "text-white/70" : "text-accent"}`}
									>
										{repliedUser.name ?? "User"}
									</p>
									<p className="opacity-70 truncate max-w-[300px]">
										{repliedMessage.content.length > 25
											? `${repliedMessage.content.slice(0, 25)}...`
											: repliedMessage.content}
									</p>
								</Button>
							)}

							<MediaPreview message={message} isOwn={isOwn} />

							<div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1">
								<p
									className="break-all whitespace-pre-wrap flex-1 min-w-[10px]"
									style={{ fontSize: "var(--msg-font-size, 14px)" }}
								>
									<MentionText
										content={message.content}
										ownUsername={ownUsername}
										isOwn={isOwn}
									/>
								</p>
								<div
									className={`flex items-center gap-1 shrink-0 mb-[-2px] ${isOwn ? "ml-auto" : ""}`}
								>
									{message.edited && (
										<span className="text-[10px] opacity-50 italic">
											edited
										</span>
									)}
									<span className="text-[10px] opacity-60 font-medium">
										{formatChatTime(message.timestamp)}
									</span>
									{isOwn && message.status && (
										<div className="flex items-center opacity-60">
											{message.status === "sending" && (
												<Clock className="w-3.5 h-3.5" />
											)}
											{message.status === "sent" && (
												<Check className="w-3.5 h-3.5" />
											)}
											{message.status === "read" && (
												<CheckDouble className="w-3.5 h-3.5" />
											)}
										</div>
									)}
								</div>
							</div>
						</Card>
					</div>
				</div>
			</div>

			{/* Context Menu Dropdown - Portaled to body */}
			{typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed w-0 h-0 p-0 m-0 overflow-visible pointer-events-none"
						style={{ left: position.x, top: position.y, zIndex: 9999 }}
					>
						<Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
							<Dropdown.Trigger>
								<div className="w-0 h-0 opacity-0 outline-none p-0 m-0 border-none pointer-events-auto" />
							</Dropdown.Trigger>
							<Dropdown.Popover
								placement="bottom start"
								offset={2}
								className="min-w-[160px]"
							>
								<Dropdown.Menu
									aria-label="Message actions"
									onAction={(key) => handleAction(key)}
								>
									{actions.map((action) => (
										<Dropdown.Item
											key={action.id}
											id={action.id}
											textValue={action.label}
											className={
												action.intent === "danger" ? "text-danger" : ""
											}
										>
											{action.icon}
											<Label>{action.label}</Label>
											{action.shortcut && (
												<Kbd
													className="ms-auto"
													slot="keyboard"
													variant="light"
												>
													<Kbd.Content>{action.shortcut}</Kbd.Content>
												</Kbd>
											)}
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					</div>,
					document.body,
				)}
		</>
	);
}
