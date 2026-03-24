"use client";
import { ArrowDownToLine, ArrowRightFromSquare, Copy } from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Input,
	Label,
	Separator,
	TextField,
	toast,
} from "@heroui/react";
import { useState } from "react";
import { ExportAccountModal } from "../ExportAccountModal";
import { updateAvatar } from "@/hooks/useAccounts";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ImageCropModal } from "../ImageCropModal";
import { useMessengerState } from "@/hooks";

export function AccountPanel() {
	const { currentUser } = useMessengerState();
	const [isExportModalOpen, setIsExportModalOpen] = useState(false);
	const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
	const [avatarUrl, setAvatarUrl] = useState<string | null>(
		typeof window !== "undefined" ? localStorage.getItem("avatarUrl") : null,
	);

	const copyField = (key: string, label: string) => {
		navigator.clipboard.writeText(localStorage.getItem(key) || "");
		toast(`Copied ${label}`, { variant: "success" });
	};

	const [isCropOpen, setIsCropOpen] = useState(false);
	const [selectedImageSrc, setSelectedImageSrc] = useState("");
	const [mimeType, setMimeType] = useState("image/jpeg");

	const handleUpdateAvatar = async () => {
		try {
			const selected = await open({
				filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif"] }],
				multiple: false,
			});

			if (!selected) return;
			const path = Array.isArray(selected) ? selected[0] : selected;

			// Detect mime type from file path
			let detectedMime = "image/jpeg";
			const ext = path.split(".").pop()?.toLowerCase();
			if (ext === "png") detectedMime = "image/png";
			else if (ext === "jpg" || ext === "jpeg") detectedMime = "image/jpeg";
			else if (ext === "gif") detectedMime = "image/gif";
			else if (ext === "webp") detectedMime = "image/webp";
			const bytes = await readFile(path);
			const blob = new Blob([bytes]);
			const dataUrl = URL.createObjectURL(blob);

			setMimeType(detectedMime);
			setSelectedImageSrc(dataUrl);
			setIsCropOpen(true);
		} catch (error) {
			console.error("Failed to pick image:", error);
		}
	};

	const onCropComplete = async (croppedBlob: Blob) => {
		setIsUpdatingAvatar(true);
		try {
			const arrayBuffer = await croppedBlob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			// Get dimensions for the final upload
			const dimensions = await new Promise<{ width: number; height: number }>(
				(resolve) => {
					const img = new Image();
					img.src = URL.createObjectURL(croppedBlob);
					img.onload = () => {
						resolve({ width: img.width, height: img.height });
						URL.revokeObjectURL(img.src);
					};
				},
			);

			const newAvatarUrl = await updateAvatar(uint8Array, dimensions, mimeType);
			if (newAvatarUrl) {
				const avatarUrl = `${newAvatarUrl}?t=${Date.now()}`;
				localStorage.setItem("avatarUrl", avatarUrl);
				setAvatarUrl(avatarUrl);
				if (currentUser) {
					currentUser.avatar = avatarUrl;
				}
			}
		} catch (error) {
			console.error("Failed to save cropped image:", error);
		} finally {
			setIsUpdatingAvatar(false);
			URL.revokeObjectURL(selectedImageSrc);
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-2xl font-bold mb-1">Account</h3>
				<p className="text-muted text-sm">
					Manage your personal information and session.
				</p>
			</div>

			{/* Avatar */}
			<div className="flex items-center gap-6 py-2">
				<Avatar
					size="lg"
					className="w-24 h-24 text-3xl font-bold bg-accent/20 text-accent"
				>
					{avatarUrl && (
						<Avatar.Image
							src={avatarUrl}
							alt={localStorage.getItem("username") || "User"}
						/>
					)}
					<Avatar.Fallback>
						{typeof window !== "undefined"
							? localStorage.getItem("username")?.slice(0, 1).toUpperCase() ||
								"U"
							: "U"}
					</Avatar.Fallback>
				</Avatar>
				<div className="space-y-3">
					<div className="flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							onPress={handleUpdateAvatar}
							isPending={isUpdatingAvatar}
						>
							Change Avatar
						</Button>
						<Button variant="ghost" size="sm" className="text-danger">
							Remove
						</Button>
					</div>
					<p className="text-xs text-muted">JPG, GIF or PNG. 1MB max.</p>
				</div>
			</div>

			<Separator className="opacity-50" />

			{/* Info fields */}
			<div className="grid gap-6">
				<div className="grid grid-cols-2 gap-4">
					{(
						[
							{ key: "username", label: "Username" },
							{ key: "userId", label: "User ID" },
						] as const
					).map(({ key, label }) => (
						<TextField key={key} isReadOnly>
							<Label>{label}</Label>
							<div className="relative group/field">
								<Input
									value={
										typeof window !== "undefined"
											? (localStorage.getItem(key) ?? "")
											: ""
									}
									className="pr-10"
								/>
								<Button
									variant="ghost"
									isIconOnly
									size="sm"
									className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
									onPress={() => copyField(key, label)}
								>
									<Copy className="size-4" />
								</Button>
							</div>
						</TextField>
					))}
				</div>

				<div className="grid grid-cols-2 gap-4">
					{(
						[
							{ key: "publicAddress", label: "Public Address" },
							{ key: "serverAddress", label: "Server Address" },
						] as const
					).map(({ key, label }) => (
						<TextField key={key} isReadOnly>
							<Label>{label}</Label>
							<div className="relative group/field">
								<Input
									value={
										typeof window !== "undefined"
											? (localStorage.getItem(key) ?? "")
											: ""
									}
									className="pr-10"
								/>
								<Button
									variant="ghost"
									isIconOnly
									size="sm"
									className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
									onPress={() => copyField(key, label)}
								>
									<Copy className="size-4" />
								</Button>
							</div>
						</TextField>
					))}
				</div>
			</div>

			<Separator className="opacity-50" />

			{/* Actions */}
			<div className="flex flex-col gap-3 pt-2">
				<h4 className="font-semibold text-sm">Account Actions</h4>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="secondary"
						className="flex-1 min-w-[140px]"
						onPress={() => setIsExportModalOpen(true)}
					>
						<ArrowDownToLine className="size-4 mr-2" />
						Export Account
					</Button>
					<Button
						variant="ghost"
						className="flex-1 min-w-[140px] border-danger/50 text-danger hover:bg-danger/10"
						onPress={() => {
							localStorage.clear();
							window.location.reload();
						}}
					>
						<ArrowRightFromSquare className="size-4 mr-2" />
						Log Out
					</Button>
				</div>
			</div>

			<ExportAccountModal
				isOpen={isExportModalOpen}
				onOpenChange={setIsExportModalOpen}
			/>

			{isCropOpen && (
				<ImageCropModal
					isOpen={isCropOpen}
					onOpenChange={setIsCropOpen}
					imageSrc={selectedImageSrc}
					onCropComplete={onCropComplete}
					mimeType={mimeType}
				/>
			)}
		</div>
	);
}
