import { toast } from "@heroui/react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";
import type { Message } from "./messengerTypes";
import { useMessengerState } from "./useMessengerState";

const generateMessageId = () => Math.floor(Math.random() * 1000000000000);

export function useSendMessage() {
	const { addMessage, updateMessageStatus, editMessage } = useMessengerState();
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const sendMessage = async (
		chatId: string,
		content: string,
		userId: string,
		options: {
			file?: string;
			replyTo?: string;
			editId?: string;
			expires?: number;
		} = {},
	): Promise<Message | null> => {
		if (!content.trim() && !options.file) {
			setError("Message cannot be empty");
			return null;
		}

		setSending(true);
		setError(null);
		const messageId = generateMessageId();

		if (options.editId) {
			// Optimistically update the existing message
			editMessage(chatId, options.editId, content.trim());
			updateMessageStatus(chatId, options.editId, "sending");
		} else {
			const fileName = options.file?.split(/[\\/]/).pop();
			const newMessage: Message = {
				id: messageId.toString(),
				chatId,
				senderId: userId || "0",
				content: content.trim(),
				timestamp: new Date().toISOString(),
				isOwn: true,
				status: "sending",
				reply_to: options.replyTo,
				edited: !!options.editId,
				expires: options.expires,
				media_name: fileName,
				media: options.file ? convertFileSrc(options.file) : undefined,
				is_file: !!options.file,
			};

			// Optimistically add the new message
			addMessage(chatId, newMessage);
		}

		try {
			await invoke<number>("send_group_message", {
				groupId: chatId,
				messageId: messageId,
				text: content.trim(),
				file: options.file || null,
				replyMessageId: options.replyTo || null,
				editMessageId: options.editId || null,
				expires: options.expires || null,
			});

			if (options.editId) {
				updateMessageStatus(chatId, options.editId, "sent");
			} else {
				updateMessageStatus(chatId, messageId.toString(), "sent");
			}

			setSending(false);
			return {
				id: messageId.toString(),
				senderId: userId,
				chatId,
				content: content.trim(),
				status: "sent",
				timestamp: new Date().toISOString(),
				isOwn: true,
			} as Message;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error("Error sending message:", err);
			setError(errorMessage);

			if (options.editId) {
				updateMessageStatus(chatId, options.editId, "error");
			} else {
				updateMessageStatus(chatId, messageId.toString(), "error");
			}

			toast(`Failed to send message: ${errorMessage}`, { variant: "danger" });
			setSending(false);
			return null;
		}
	};

	return {
		sendMessage,
		sending,
		error,
	};
}
