"use client";

import { Comment, Gear, Persons, SquareFill } from "@gravity-ui/icons";
import { Avatar, Badge, Button, Dropdown, Label } from "@heroui/react";
import { useEffect, useState } from "react";
import {
	MessengerProvider,
	useMessengerState,
} from "@/hooks/useMessengerState";
import { ChatArea } from "./ChatArea";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TopBar } from "./TopBar";
import "./messenger.css";
import { getStatusColor, handleStatusChange } from "@/hooks/useContacts";
import { SettingsModal } from "../settings/SettingsModal";

function MessengerContent() {
	const { setAnimatingIn, currentUser, upsertUser } = useMessengerState();
	const [showMessages, setShowMessages] = useState(true);
	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		setAnimatingIn(true);
		const timer = setTimeout(() => setAnimatingIn(false), 600);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Empty dependency array - only run once on mount

	return (
		<div className="flex h-screen bg-background overflow-hidden gap-4 p-4">
			{/* Navigation Sidebar - Minimal icons only */}
			<div className="w-16 rounded-2xl border border-border flex flex-col items-center py-4 gap-4">
				<Dropdown>
					<Dropdown.Trigger>
						<div className="cursor-pointer">
							<Badge.Anchor>
								<Avatar size="md" className="shadow-lg border-2 border-surface">
									{currentUser?.avatar && (
										<Avatar.Image
											src={currentUser.avatar}
											alt={currentUser.name}
										/>
									)}
									<Avatar.Fallback className="bg-gradient-to-br from-accent to-accent-surface text-accent-foreground font-bold">
										{currentUser?.name?.slice(0, 1).toUpperCase() || "U"}
									</Avatar.Fallback>
								</Avatar>
								<Badge
									color={getStatusColor(currentUser?.status)}
									placement="bottom-right"
									size="sm"
									variant="primary"
									className="border-2 border-surface cursor-pointer hover:scale-110 transition-transform"
								/>
							</Badge.Anchor>
						</div>
					</Dropdown.Trigger>
					<Dropdown.Popover
						placement="right top"
						offset={12}
						className="min-w-[150px]"
					>
						<Dropdown.Menu
							aria-label="Status Actions"
							onAction={(key) =>
								handleStatusChange(
									currentUser!,
									upsertUser,
									key.toString().toUpperCase(),
								)
							}
						>
							<Dropdown.Section>
								<Dropdown.Item id="Online" textValue="Online">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-success" />
										<Label>Online</Label>
									</div>
								</Dropdown.Item>
								<Dropdown.Item id="Away" textValue="Away">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-warning" />
										<Label>Away</Label>
									</div>
								</Dropdown.Item>
								<Dropdown.Item id="Busy" textValue="Busy">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-danger" />
										<Label>Do Not Disturb</Label>
									</div>
								</Dropdown.Item>
								<Dropdown.Item id="Offline" textValue="Invisible">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-default" />
										<Label>Invisible</Label>
									</div>
								</Dropdown.Item>
							</Dropdown.Section>
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>

				<div className="flex flex-col gap-3 mt-2">
					<Button
						isIconOnly
						variant="ghost"
						className="w-10 h-10 rounded-lg hover:bg-on-surface text-muted border-none"
					>
						<SquareFill className="w-5 h-5" />
					</Button>
					<Button
						isIconOnly
						variant="ghost"
						className="w-10 h-10 rounded-lg hover:bg-on-surface text-muted border-none"
					>
						<Persons className="w-5 h-5" />
					</Button>
					<Button
						isIconOnly
						variant="ghost"
						onPress={() => setShowMessages(!showMessages)}
						className={`w-10 h-10 rounded-lg hover:bg-on-surface transition border-none ${showMessages ? "bg-accent/10 text-accent" : "text-muted"}`}
					>
						<Comment className="w-5 h-5" />
					</Button>
				</div>
				<div className="flex-1" />
				<Button
					isIconOnly
					variant="ghost"
					onPress={() => setShowSettings(true)}
					className="w-10 h-10 rounded-lg hover:bg-on-surface text-muted border-none"
				>
					<Gear className="w-5 h-5" />
				</Button>
			</div>

			{/* Left Panel - Messages List (Closable with Animation) */}
			<div
				className={`overflow-hidden transition-all duration-300 ease-in-out ${
					showMessages ? "w-64 opacity-100" : "w-0 opacity-0"
				}`}
			>
				<div className="w-64 bg-background rounded-2xl flex flex-col overflow-hidden h-full">
					<LeftSidebar onClose={() => setShowMessages(false)} />
				</div>
			</div>

			{/* Main Chat Area */}
			<div className="flex-1 bg-background rounded-2xl flex flex-col overflow-hidden">
				<TopBar onInfoClick={() => setShowGroupInfo(!showGroupInfo)} />
				<ChatArea />
			</div>

			{/* Right Panel - Group Info Sidebar (Wider with Animation) */}
			<div
				className={`overflow-hidden transition-all duration-300 ease-in-out ${
					showGroupInfo ? "w-96 opacity-100" : "w-0 opacity-0"
				}`}
			>
				<div className="w-96 bg-background rounded-2xl border border-border flex flex-col overflow-hidden h-full">
					<RightSidebar
						onClose={() => setShowGroupInfo(false)}
						onToggle={() => setShowGroupInfo(!showGroupInfo)}
					/>
				</div>
			</div>

			<SettingsModal isOpen={showSettings} onOpenChange={setShowSettings} />
		</div>
	);
}

export function MainMenu() {
	return (
		<MessengerProvider>
			<MessengerContent />
		</MessengerProvider>
	);
}

export default MainMenu;
