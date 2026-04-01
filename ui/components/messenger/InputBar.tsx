"use client";
import {
	ArrowLeft,
	FaceSmile,
	Microphone,
	PaperPlane,
	Pencil,
	Plus,
	Xmark,
} from "@gravity-ui/icons";
import { Button, InputGroup, Spinner, TextField, toast } from "@heroui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChats } from "@/hooks";
import type { Message } from "@/hooks/messengerTypes";
import { useMessengerState } from "@/hooks/useMessengerState";
import { useSendMessage } from "@/hooks/useSendMessage";

interface InputBarProps {
	replyTo?: Message | null;
	editTarget?: Message | null;
	onClearReply?: () => void;
	onClearEdit?: () => void;
}

export function InputBar({
	replyTo,
	editTarget,
	onClearReply,
	onClearEdit,
}: InputBarProps) {
	const { uiState, contacts, currentUser } = useMessengerState();
	const { sendMessage, sending } = useSendMessage();
	const [messageContent, setMessageContent] = useState("");
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const { getChatById } = useChats();
	const activeChat = uiState.activeChatId
		? getChatById(uiState.activeChatId)
		: null;
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// @mention autocomplete state
	const [mentionQuery, setMentionQuery] = useState<string | null>(null);
	const [mentionStart, setMentionStart] = useState<number>(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	

	// When editTarget changes, pre-fill input
	useEffect(() => {
		if (editTarget) {
			setMessageContent(editTarget.content);
			textareaRef.current?.focus();
		} else if (!editTarget) {
			// Only clear if we were in edit mode
		}
	}, [editTarget?.id]);

	// When replyTo changes, focus the textarea
	useEffect(() => {
		if (replyTo) textareaRef.current?.focus();
	}, [replyTo?.id]);

	// Derive members for autocomplete
	const memberSuggestions = useCallback(() => {
		if (!activeChat?.group_config?.members) return [];
		return activeChat.group_config.members
			.map((id) => contacts[id.toString()])
			.filter(Boolean)
			.filter(
				(u) =>
					!mentionQuery ||
					u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()),
			);
	}, [activeChat?.group_config?.members, contacts, mentionQuery]);
	const suggestions = memberSuggestions();
	const showAutocomplete = mentionQuery !== null && suggestions.length > 0;


	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setMessageContent(val);

		// Detect @mention pattern: find last @ before cursor
		const cursor = e.target.selectionStart ?? val.length;
		const before = val.slice(0, cursor);
		const atIdx = before.lastIndexOf("@");
		if (atIdx !== -1) {
			const fragment = before.slice(atIdx + 1);
			// Show autocomplete only if no space after @
			if (!fragment.includes(" ")) {
				setMentionQuery(fragment);
				setMentionStart(atIdx);
				setSelectedIndex(0);
				return;
			}
		}
		setMentionQuery(null);
		setSelectedIndex(0);
	};

	const insertMention = (name: string) => {
		const before = messageContent.slice(0, mentionStart);
		const after = messageContent.slice(
			mentionStart + 1 + (mentionQuery?.length ?? 0),
		);
		setMessageContent(`${before}@${name} ${after}`);
		setMentionQuery(null);
		setTimeout(() => textareaRef.current?.focus(), 0);
	};

	const handleSend = () => {
		if (!uiState.activeChatId || !messageContent.trim() || sending) return;
		const contentToSend = messageContent;
		setMessageContent("");
		setMentionQuery(null);
		sendMessage(uiState.activeChatId, contentToSend, currentUser?.id || "", {
			replyTo: replyTo?.id,
			editId: editTarget?.id,
			file: selectedFile || undefined,
		});
		onClearReply?.();
		onClearEdit?.();
		setSelectedFile(null);
	};

	const handlePickFile = async () => {
		try {
			const selected = await open({
				multiple: false,
			});

			if (!selected) return;
			const path = Array.isArray(selected) ? selected[0] : selected;

			if (uiState.activeChatId) {
				setSelectedFile(path);
			}
		} catch (error) {
			console.error("Failed to pick file:", error);
			toast(`Failed to pick file: ${error}`, { variant: "danger" });
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (showAutocomplete) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % suggestions.slice(0, 6).length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex(
					(prev) =>
						(prev - 1 + suggestions.slice(0, 6).length) %
						suggestions.slice(0, 6).length,
				);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				const selectedUser = suggestions[selectedIndex];
				if (selectedUser) {
					insertMention(selectedUser.name);
				}
				return;
			}
		}

		if (e.key === "Escape") {
			setMentionQuery(null);
			setSelectedIndex(0);
			onClearReply?.();
			onClearEdit?.();
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
			e.preventDefault();
			handleSend();
		}
	};

	const isEditing = Boolean(editTarget);
	const isReplying = Boolean(replyTo);
	const isAttaching = Boolean(selectedFile);
	const repliedUser = contacts[replyTo?.senderId || ""];

	const attachedFileName = selectedFile?.split(/[\\/]/).pop() || "File";

	return (
		<div className="flex flex-col bg-background">
			{/* File attachment banner */}
			{isAttaching && (
				<div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-accent/5 animate-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 shrink-0">
						<Plus className="w-4 h-4 text-accent rotate-45" />{" "}
						{/* Use Plus as a generic file icon or similar */}
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-xs text-accent font-semibold">Attachment</p>
						<p className="text-xs text-muted truncate">{attachedFileName}</p>
					</div>
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						className="text-muted shrink-0"
						onPress={() => setSelectedFile(null)}
					>
						<Xmark className="w-4 h-4" />
					</Button>
				</div>
			)}

			{/* Reply banner */}
			{isReplying && (
				<div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-accent/5 animate-in slide-in-from-bottom-2 duration-200">
					<ArrowLeft className="w-4 h-4 text-accent shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-xs text-accent font-semibold">
							{repliedUser.name ?? "User"}
						</p>
						<p className="text-xs text-muted truncate">{replyTo?.content}</p>
					</div>
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						className="text-muted shrink-0"
						onPress={onClearReply}
					>
						<Xmark className="w-4 h-4" />
					</Button>
				</div>
			)}

			{/* Edit banner */}
			{isEditing && (
				<div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-warning/5 animate-in slide-in-from-bottom-2 duration-200">
					<Pencil className="w-4 h-4 text-warning shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-xs text-warning font-semibold">
							Editing message
						</p>
						<p className="text-xs text-muted truncate">{editTarget?.content}</p>
					</div>
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						className="text-muted shrink-0"
						onPress={() => {
							onClearEdit?.();
							setMessageContent("");
						}}
					>
						<Xmark className="w-4 h-4" />
					</Button>
				</div>
			)}

			{/* @mention autocomplete popup */}
			{showAutocomplete && (
				<div className="mx-4 mb-1 border border-border rounded-xl bg-surface shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
					{suggestions.slice(0, 6).map((user, index) => (
						<Button
							key={user.id}
							type="button"
							variant="ghost"
							className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left border-none shadow-none justify-start min-h-0 h-auto ${
								index === selectedIndex
									? "bg-accent/20 text-accent font-semibold"
									: "bg-transparent hover:bg-accent/10"
							}`}
							onMouseDown={(e: React.MouseEvent) => {
								e.preventDefault();
								insertMention(user.name);
							}}
						>
							<span
								className={`font-medium ${index === selectedIndex ? "text-accent" : "text-accent/70"}`}
							>
								@
							</span>
							<span>{user.name}</span>
						</Button>
					))}
				</div>
			)}

			<div className="min-h-[72px] flex items-center px-4 gap-3 py-3">
				{/* Plus Button */}
				<Button
					isIconOnly
					aria-label="Add attachment"
					size="lg"
					variant="ghost"
					isDisabled={!uiState.activeChatId}
					onPress={handlePickFile}
					className="flex-shrink-0 rounded-2xl bg-on-surface hover:bg-on-surface-hover text-muted"
				>
					<Plus className="w-6 h-6" />
				</Button>

				{/* TextField */}
				<TextField
					fullWidth
					aria-label="Message input"
					name="message"
					className="flex-1"
				>
					<InputGroup
						fullWidth
						className={`rounded-2xl border focus-within:border-field-border-focus transition-colors ${
							isEditing
								? "bg-warning/5 border-warning/30"
								: "bg-surface border-field-border"
						}`}
					>
						<InputGroup.TextArea
							ref={textareaRef}
							placeholder={
								isEditing ? "Edit your message…" : "Type your message"
							}
							value={messageContent}
							onChange={handleTextChange}
							onKeyDown={handleKeyDown}
							disabled={
								!uiState.activeChatId ||
								!activeChat?.group_config?.permissions[currentUser?.id || ""]
									.send_messages
							}
							rows={1}
							className="w-full resize-none px-4 py-2.5 bg-transparent text-field-foreground placeholder:text-field-placeholder text-base max-h-32 leading-relaxed min-h-[44px] disabled:opacity-50"
						/>
						<InputGroup.Suffix className="flex items-center gap-1.5 px-3 py-2">
							<Button
								isIconOnly
								aria-label="Add emoji"
								size="sm"
								variant="ghost"
								isDisabled={!uiState.activeChatId}
								className="text-muted hover:bg-on-surface-hover"
							>
								<FaceSmile className="w-5 h-5" />
							</Button>
							<Button
								isIconOnly
								aria-label={
									messageContent.trim() || selectedFile
										? isEditing
											? "Save edit"
											: "Send message"
										: "Voice input"
								}
								size="sm"
								variant={
									messageContent.trim() || selectedFile
										? isEditing
											? "secondary"
											: "primary"
										: "ghost"
								}
								isDisabled={!uiState.activeChatId || sending}
								isPending={sending}
								onPress={
									messageContent.trim() || selectedFile ? handleSend : undefined
								}
								className={
									messageContent.trim() || selectedFile
										? ""
										: "text-muted hover:bg-on-surface-hover"
								}
							>
								{({ isPending }: { isPending: boolean }) =>
									isPending ? (
										<Spinner color="current" size="sm" />
									) : messageContent.trim() || selectedFile ? (
										<PaperPlane className="w-4 h-4" />
									) : (
										<Microphone className="w-5 h-5" />
									)
								}
							</Button>
						</InputGroup.Suffix>
					</InputGroup>
				</TextField>
			</div>
		</div>
	);
}
