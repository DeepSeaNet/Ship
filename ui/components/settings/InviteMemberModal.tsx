"use client";

import { Check, Copy, Magnifier, PersonPlus, Xmark } from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Input,
	Label,
	Modal,
	TextField,
	toast,
} from "@heroui/react";
import { useMemo, useState } from "react";
import { useMessengerState } from "@/hooks";
import type { Chat } from "@/hooks/messengerTypes";
import { useGroups } from "@/hooks/useGroups";

interface InviteMemberModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	group: Chat;
}

const formatUserId = (id: string): string => {
	if (id.length === 64) {
		return `${id.slice(0, 6)}...${id.slice(-6)}`;
	}
	return id;
};

const isValidUserId = (id: string): boolean => {
	return /^[a-f0-9]{64}$/i.test(id);
};

export function InviteMemberModal({
	isOpen,
	onOpenChange,
	group,
}: InviteMemberModalProps) {
	const { inviteUserToGroup } = useGroups();
	const { contacts } = useMessengerState();

	const [inviteMethod, setInviteMethod] = useState<"contacts" | "id">(
		"contacts",
	);
	const [invitingUserId, setInvitingUserId] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isInviting, setIsInviting] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const handleInvite = async (userId?: string) => {
		const idToInvite = userId || invitingUserId;
		if (!idToInvite) return;

		if (inviteMethod === "id" && !isValidUserId(idToInvite)) {
			toast("Invalid User ID format", { variant: "danger" });
			return;
		}

		setIsInviting(true);
		const success = await inviteUserToGroup(group.id, idToInvite);
		setIsInviting(false);
		if (success) {
			setInvitingUserId("");
			toast("User invited successfully", { variant: "success" });
			if (inviteMethod === "id") {
				onOpenChange(false);
			}
		}
	};

	const handleCopyId = async (id: string) => {
		await navigator.clipboard.writeText(id);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const handlePaste = async () => {
		const text = await navigator.clipboard.readText();
		setInvitingUserId(text.trim());
	};

	const filteredContacts = useMemo(() => {
		return Object.values(contacts).filter(
			(c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.id.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [contacts, searchQuery]);

	const isIdValid = isValidUserId(invitingUserId);

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Backdrop>
				<Modal.Container>
					<Modal.Dialog className="sm:max-w-[420px]">
						<Modal.CloseTrigger />
						<Modal.Header className="px-1 pt-2">
							<Modal.Icon className="bg-accent/10 text-accent">
								<PersonPlus className="size-5" />
							</Modal.Icon>
							<Modal.Heading>Invite Members</Modal.Heading>
						</Modal.Header>

						<Modal.Body className="space-y-3 px-1">
							{/* Tab switcher */}
							<div className="flex bg-surface/40 p-0.5 rounded-lg w-full border border-border/10">
								<Button
									size="sm"
									variant={inviteMethod === "contacts" ? "secondary" : "ghost"}
									onPress={() => setInviteMethod("contacts")}
									className={`flex-1 h-8 rounded-md text-xs transition-all ${
										inviteMethod === "contacts"
											? "shadow-sm font-semibold"
											: "text-muted hover:text-foreground"
									}`}
								>
									My Contacts
								</Button>
								<Button
									size="sm"
									variant={inviteMethod === "id" ? "secondary" : "ghost"}
									onPress={() => setInviteMethod("id")}
									className={`flex-1 h-8 rounded-md text-xs transition-all ${
										inviteMethod === "id"
											? "shadow-sm font-semibold"
											: "text-muted hover:text-foreground"
									}`}
								>
									By ID
								</Button>
							</div>

							{/* Invite by ID */}
							{/* Invite by ID */}
							{inviteMethod === "id" ? (
								<div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 w-full">
									<TextField className="w-full">
										<Label className="mb-1.5 text-sm font-medium">
											Member ID
										</Label>
										<div className="relative w-full">
											<Input
												placeholder="64-character hex string"
												value={invitingUserId}
												onChange={(e) =>
													setInvitingUserId(e.target.value.trim())
												}
												variant="secondary"
												// h-12 увеличивает высоту, w-full растягивает
												className={`w-full h-12 font-mono text-sm pr-20 ${
													invitingUserId
														? isIdValid
															? "border-success/50"
															: "border-danger/50"
														: ""
												}`}
											/>
											<Button
												size="sm"
												variant="ghost"
												onPress={handlePaste}
												// Центрируем кнопку Paste в более высоком поле
												className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 text-xs text-accent bg-background/50 hover:bg-background shadow-sm"
											>
												Paste
											</Button>
										</div>
										{invitingUserId && !isIdValid && (
											<p className="text-xs text-danger mt-1.5 ml-1">
												Must be 64 hexadecimal characters
											</p>
										)}
									</TextField>
								</div>
							) : (
								/* Contact list */
								<div className="flex flex-col min-h-0 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200 w-full">
									<TextField className="w-full">
										<div className="relative w-full">
											<Magnifier className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
											<Input
												placeholder="Search contacts..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												variant="secondary"
												// Увеличенная высота h-12 и отступ под иконку
												className="w-full h-12 pl-10 pr-10 text-sm"
											/>
											{searchQuery && (
												<button
													type="button"
													onClick={() => setSearchQuery("")}
													className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center hover:bg-surface rounded-full transition-colors"
												>
													<Xmark className="w-4 h-4" />
												</button>
											)}
										</div>
									</TextField>

									<div className="max-h-[260px] overflow-y-auto space-y-0.5 -mx-1 px-1">
										{filteredContacts.length === 0 ? (
											<div className="flex flex-col items-center justify-center py-8 text-center">
												<Magnifier className="w-7 h-7 text-muted/30 mb-2" />
												<p className="text-sm font-medium text-muted">
													{searchQuery ? "No matches found" : "No contacts"}
												</p>
												<p className="text-xs text-muted/60 mt-0.5">
													{searchQuery
														? "Try a different search"
														: "Add contacts to invite them"}
												</p>
											</div>
										) : (
											filteredContacts.map((contact) => {
												const isMember = group.group_config?.members?.includes(
													contact.id,
												);
												const isCurrentlyCopied = copiedId === contact.id;

												return (
													<div
														key={contact.id}
														className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface/50 transition-colors group/item"
													>
														<div className="flex items-center gap-2.5 flex-1 min-w-0">
															<Avatar size="sm">
																{contact.avatar && (
																	<Avatar.Image src={contact.avatar} />
																)}
																<Avatar.Fallback className="bg-accent/20 text-accent font-bold text-xs">
																	{contact.name.slice(0, 1).toUpperCase()}
																</Avatar.Fallback>
															</Avatar>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-medium leading-tight truncate">
																	{contact.name}
																</p>
																<div className="flex items-center gap-1 mt-0.5">
																	<p className="text-[10px] text-muted font-mono truncate">
																		{formatUserId(contact.id)}
																	</p>
																	<button
																		type="button"
																		onClick={() => handleCopyId(contact.id)}
																		className="opacity-0 group-hover/item:opacity-100 transition-opacity"
																	>
																		{isCurrentlyCopied ? (
																			<Check className="w-2.5 h-2.5 text-success" />
																		) : (
																			<Copy className="w-2.5 h-2.5 text-muted hover:text-accent" />
																		)}
																	</button>
																</div>
															</div>
														</div>
														<Button
															size="sm"
															variant="ghost"
															className={`h-7 px-2.5 text-xs font-medium shrink-0 ${
																isMember
																	? "text-muted/50 cursor-default"
																	: "text-accent hover:bg-accent/10"
															}`}
															onPress={() =>
																!isMember && handleInvite(contact.id)
															}
															isDisabled={isMember}
														>
															{isMember ? "Member" : "Invite"}
														</Button>
													</div>
												);
											})
										)}
									</div>
								</div>
							)}
						</Modal.Body>

						<Modal.Footer className="px-8 pb-8">
							<div className="flex w-full gap-2">
								<Button
									variant="secondary"
									onPress={() => onOpenChange(false)}
									className="flex-1"
								>
									Cancel
								</Button>
								{inviteMethod === "id" && (
									<Button
										variant="primary"
										onPress={() => handleInvite()}
										isPending={isInviting}
										isDisabled={!isIdValid}
										className="flex-1"
									>
										Send Invite
									</Button>
								)}
							</div>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
