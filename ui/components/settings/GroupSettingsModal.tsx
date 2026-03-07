"use client";

import {
	Bell,
	Gear,
	PersonPlus,
	Shield,
	TrashBin,
	Xmark,
} from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Description,
	Input,
	Label,
	ListBox,
	Modal,
	Separator,
	Surface,
	Switch,
	Tabs,
	TextArea,
	TextField,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { Chat, Permissions } from "@/hooks/messengerTypes";
import { useGroups } from "@/hooks/useGroups";
import { useMessengerState } from "@/hooks/useMessengerState";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { InviteMemberModal } from "./InviteMemberModal";

interface GroupSettingsModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	group: Chat;
}

const ROLE_DEFAULTS: Record<string, Permissions> = {
	Admin: {
		send_messages: true,
		manage_members: true,
		pin_messages: true,
		delete_messages: true,
		rename_group: true,
		manage_permissions: true,
		manage_admins: true,
	},
	Moderator: {
		send_messages: true,
		manage_members: true,
		pin_messages: true,
		delete_messages: true,
		rename_group: false,
		manage_permissions: false,
		manage_admins: false,
	},
	Member: {
		send_messages: true,
		manage_members: false,
		pin_messages: false,
		delete_messages: false,
		rename_group: false,
		manage_permissions: false,
		manage_admins: false,
	},
	Reader: {
		send_messages: false,
		manage_members: false,
		pin_messages: false,
		delete_messages: false,
		rename_group: false,
		manage_permissions: false,
		manage_admins: false,
	},
};

export const GroupSettingsModal = ({
	isOpen,
	onOpenChange,
	group,
}: GroupSettingsModalProps) => {
	const {
		updateGroupConfig,
		removeUserFromGroup,
		inviteUserToGroup,
		checkPermission,
		updateMemberPermissions,
	} = useGroups();
	const { contacts } = useMessengerState();
	const { settings: globalNotifs, updateChatSetting } =
		useNotificationSettings();

	const chatSettings = globalNotifs.chatOverrides[group.id] || {
		muted: false,
		mentionsOnly: false,
	};

	// State for general settings
	const [name, setName] = useState(group.name);
	const [description, setDescription] = useState(group.description || "");
	const [visibility, setVisibility] = useState(
		group.group_config?.visibility?.toLowerCase() || "private",
	);
	const [joinMode, setJoinMode] = useState(
		group.group_config?.join_mode?.toLowerCase() || "invite_only",
	);
	const [isLoading, setIsLoading] = useState(false);

	// State for default permissions
	const [defaultPerms, setDefaultPerms] = useState<any>(() => ({
		...(group.default_permissions || {
			manage_members: false,
			send_messages: true,
			delete_messages: false,
			rename_group: false,
			manage_permissions: false,
			pin_messages: false,
			manage_admins: false,
		}),
		// Add group config flags to this state object for the UI form
		allow_stickers: group.group_config?.allow_stickers ?? true,
		allow_gifs: group.group_config?.allow_gifs ?? true,
		allow_voice_messages: group.group_config?.allow_voice_messages ?? true,
		allow_video_messages: group.group_config?.allow_video_messages ?? true,
		allow_links: group.group_config?.allow_links ?? true,
	}));

	// State for member management
	const [memberToEdit, setMemberToEdit] = useState<number | null>(null);
	const [memberPermissions, setMemberPermissions] =
		useState<Permissions | null>(null);
	const [memberRole, setMemberRole] = useState<string>("Member");
	const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

	// Sync state if group changes
	useEffect(() => {
		setName(group.name);
		setDescription(group.description || "");
		setVisibility(group.group_config?.visibility?.toLowerCase() || "private");
		setJoinMode(group.group_config?.join_mode?.toLowerCase() || "invite_only");
		if (group.default_permissions) setDefaultPerms(group.default_permissions);
	}, [group]);

	const handleSaveGeneral = async () => {
		setIsLoading(true);
		const success = await updateGroupConfig(group.id, {
			name,
			description,
			visibility: visibility as any,
			joinMode: joinMode as any,
			// Also save default permissions if we are on the permissions tab or just in general
			allowMessages: defaultPerms.send_messages,
		});
		setIsLoading(false);
	};

	const handleSavePermissions = async () => {
		setIsLoading(true);
		const success = await updateGroupConfig(group.id, {
			allowMessages: defaultPerms.send_messages,
			allowLinks: defaultPerms.allow_links,
			allowStickers: defaultPerms.allow_stickers,
			allowGifs: defaultPerms.allow_gifs,
			allowVoiceMessages: defaultPerms.allow_voice_messages,
			allowVideoMessages: defaultPerms.allow_video_messages,
		});
		setIsLoading(false);
	};

	const isOwner = group.owner_id?.toString() === localStorage.getItem("userId");
	const canManageMembers = checkPermission(group, "manage_members");
	const canRename = checkPermission(group, "rename_group");
	const canManagePermissions = checkPermission(group, "manage_permissions");

	const openMemberPermissionEdit = (memberId: number) => {
		setMemberToEdit(memberId);
		const currentPerms =
			group.users_permissions?.[memberId] ||
			group.default_permissions ||
			defaultPerms;
		setMemberPermissions(currentPerms);

		const isAdmin = group.admins?.includes(memberId);
		const isOwnerOfGroup = group.owner_id === memberId;

		if (isOwnerOfGroup) {
			setMemberRole("Owner");
		} else if (isAdmin) {
			setMemberRole("Admin");
		} else {
			const isModerator =
				JSON.stringify(currentPerms) ===
				JSON.stringify(ROLE_DEFAULTS.Moderator);
			const isReader =
				JSON.stringify(currentPerms) === JSON.stringify(ROLE_DEFAULTS.Reader);
			const isStandardMember =
				JSON.stringify(currentPerms) === JSON.stringify(ROLE_DEFAULTS.Member);

			if (isModerator) setMemberRole("Moderator");
			else if (isReader) setMemberRole("Reader");
			else if (isStandardMember) setMemberRole("Member");
			else setMemberRole("Custom");
		}
	};

	const handleRoleChange = (role: string) => {
		setMemberRole(role);
		if (role !== "Custom" && role !== "Owner" && ROLE_DEFAULTS[role]) {
			setMemberPermissions({ ...ROLE_DEFAULTS[role] });
		}
	};

	const handleSaveMemberPermissions = async () => {
		if (memberToEdit === null || !memberPermissions) return;
		setIsLoading(true);
		// If role is set to Admin or Member, we pass it.
		// Note: Owner cannot be changed via this UI normally.
		const success = await updateMemberPermissions(
			group.id,
			memberToEdit,
			memberPermissions,
			memberRole !== "Custom" && memberRole !== "Owner"
				? memberRole.toLowerCase()
				: undefined,
		);
		setIsLoading(false);
		if (success) {
			setMemberToEdit(null);
			setMemberPermissions(null);
		}
	};

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Backdrop>
				<Modal.Container>
					<Modal.Dialog className="p-0 overflow-hidden !bg-transparent shadow-none border-none max-w-4xl w-full">
						<Modal.CloseTrigger />
						<Modal.Body className="h-[600px] w-full bg-background flex-row items-stretch rounded-xl border border-border overflow-hidden shadow-xl">
							<Tabs
								className="w-full h-full flex flex-row"
								orientation="vertical"
								variant="secondary"
								defaultSelectedKey="general"
							>
								<Tabs.ListContainer className="w-64 border-r border-border h-full bg-surface/50 p-4 shrink-0">
									<h2 className="text-xl font-bold px-2 mb-6 ml-1 truncate">
										{group.name}
									</h2>
									<Tabs.List
										aria-label="Group settings categories"
										className="flex flex-col gap-2 w-full"
									>
										<Tabs.Tab
											id="general"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Gear className="w-4 h-4 mr-2" />
											General
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="members"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<PersonPlus className="w-4 h-4 mr-2" />
											Members
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="permissions"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Shield className="w-4 h-4 mr-2" />
											Permissions
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="notifications"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Bell className="w-4 h-4 mr-2" />
											Notifications
											<Tabs.Indicator />
										</Tabs.Tab>
									</Tabs.List>
								</Tabs.ListContainer>

								<div className="flex-1 h-full overflow-y-auto bg-background p-8 relative">
									<Button
										isIconOnly
										size="sm"
										variant="ghost"
										className="absolute top-4 right-4 z-10"
										onPress={() => onOpenChange(false)}
									>
										<Xmark className="w-5 h-5" />
									</Button>

									<Tabs.Panel
										id="general"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">
												General Settings
											</h3>
											<p className="text-muted text-sm">
												Configure basic group information and appearance.
											</p>
										</div>

										<div className="flex items-center gap-6 py-2">
											<Avatar
												size="lg"
												className="w-24 h-24 text-3xl font-bold bg-accent/20 text-accent"
											>
												{group.avatar && <Avatar.Image src={group.avatar} />}
												<Avatar.Fallback>
													{group.name.slice(0, 1).toUpperCase()}
												</Avatar.Fallback>
											</Avatar>
											<div className="space-y-3">
												<div className="flex gap-2">
													<Button
														variant="secondary"
														size="sm"
														isDisabled={!canRename}
													>
														Change Avatar
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="text-danger"
														isDisabled={!canRename}
													>
														Remove
													</Button>
												</div>
												<p className="text-xs text-muted">
													JPG, GIF or PNG. 1MB max.
												</p>
											</div>
										</div>

										<Separator className="opacity-50" />

										<div className="grid gap-4">
											<TextField isDisabled={!canRename}>
												<Label>Group Name</Label>
												<Input
													value={name}
													onChange={(e) => setName(e.target.value)}
													placeholder="Enter group name"
												/>
											</TextField>

											<TextField isDisabled={!canRename}>
												<Label>Description</Label>
												<TextArea
													value={description}
													onChange={(e) => setDescription(e.target.value)}
													placeholder="Short description of the group"
													rows={3}
												/>
											</TextField>
										</div>

										<div className="flex justify-end pt-4">
											<Button
												variant="primary"
												onPress={handleSaveGeneral}
												isPending={isLoading}
												isDisabled={
													!canRename ||
													(name === group.name &&
														description === group.description)
												}
											>
												Save Changes
											</Button>
										</div>
									</Tabs.Panel>

									<Tabs.Panel
										id="members"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div className="flex items-center justify-between">
											<div>
												<h3 className="text-2xl font-bold mb-1">Members</h3>
												<p className="text-muted text-sm">
													Manage group participants and roles.
												</p>
											</div>
											<Button
												variant="primary"
												size="sm"
												onPress={() => setIsInviteModalOpen(true)}
												isDisabled={!canManageMembers}
											>
												<PersonPlus className="w-4 h-4 mr-2" />
												Invite Members
											</Button>
										</div>

										<div className="space-y-3">
											{group.members?.map((memberId) => {
												const member = contacts[memberId.toString()];
												const isSelf =
													memberId.toString() ===
													localStorage.getItem("userId");
												const isAdmin = group.admins?.includes(memberId);
												const isOwnerOfGroup = group.owner_id === memberId;

												return (
													<div
														key={memberId}
														className="flex items-center justify-between p-3 border border-border rounded-xl bg-surface/30"
													>
														<div className="flex items-center gap-3">
															<Avatar size="sm">
																{member?.avatar && (
																	<Avatar.Image src={member.avatar} />
																)}
																<Avatar.Fallback>
																	{(member?.name || "U")
																		.slice(0, 1)
																		.toUpperCase()}
																</Avatar.Fallback>
															</Avatar>
															<div className="flex flex-col">
																<span className="text-sm font-medium">
																	{member?.name || memberId} {isSelf && "(You)"}
																</span>
																<span className="text-xs text-muted">
																	{(() => {
																		const mId =
																			Number(member?.id) || Number(memberId);
																		if (group.owner_id === mId) return "Owner";
																		if (group.admins?.includes(mId))
																			return "Admin";

																		const perms =
																			group.users_permissions?.[mId] ||
																			group.default_permissions ||
																			defaultPerms;
																		if (
																			JSON.stringify(perms) ===
																			JSON.stringify(ROLE_DEFAULTS.Moderator)
																		)
																			return "Moderator";
																		if (
																			JSON.stringify(perms) ===
																			JSON.stringify(ROLE_DEFAULTS.Reader)
																		)
																			return "Reader";
																		if (
																			JSON.stringify(perms) ===
																			JSON.stringify(ROLE_DEFAULTS.Member)
																		)
																			return "Member";
																		return "Custom";
																	})()}
																</span>
															</div>
														</div>
														<div className="flex items-center gap-2">
															{canManagePermissions && !isOwnerOfGroup && (
																<Button
																	variant="ghost"
																	isIconOnly
																	size="sm"
																	className="text-muted hover:bg-surface"
																	onPress={() =>
																		openMemberPermissionEdit(memberId)
																	}
																>
																	<Shield className="w-4 h-4" />
																</Button>
															)}
															{!isOwnerOfGroup &&
																!isSelf &&
																canManageMembers && (
																	<Button
																		variant="ghost"
																		isIconOnly
																		size="sm"
																		className="text-danger hover:bg-danger/10"
																		onPress={() =>
																			removeUserFromGroup(group.id, memberId)
																		}
																	>
																		<TrashBin className="w-4 h-4" />
																	</Button>
																)}
														</div>
													</div>
												);
											})}
										</div>
									</Tabs.Panel>

									<Tabs.Panel
										id="permissions"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">
												Default Permissions
											</h3>
											<p className="text-muted text-sm">
												Set what new members can do by default.
											</p>
										</div>

										<div className="space-y-4">
											{[
												{
													key: "send_messages",
													label: "Send Messages",
													desc: "Allow members to send text messages.",
												},
												{
													key: "manage_members",
													label: "Invite Users",
													desc: "Allow members to invite new participants.",
												},
												{
													key: "pin_messages",
													label: "Pin Messages",
													desc: "Allow members to pin important messages.",
												},
												{
													key: "delete_messages",
													label: "Delete Messages",
													desc: "Allow members to delete any message.",
												},
												{
													key: "rename_group",
													label: "Rename Group",
													desc: "Allow members to change group name and avatar.",
												},
												{
													key: "manage_permissions",
													label: "Manage Permissions",
													desc: "Allow members to change group permissions.",
												},
												{
													key: "manage_admins",
													label: "Manage Admins",
													desc: "Allow members to promote/demote admins.",
												},
												{
													key: "allow_stickers",
													label: "Stickers",
													desc: "Allow sending stickers.",
												},
												{
													key: "allow_gifs",
													label: "GIFs",
													desc: "Allow sending GIFs.",
												},
											].map(({ key, label, desc }) => (
												<div
													key={key}
													className="flex items-center justify-between"
												>
													<div className="space-y-0.5">
														<Label className="font-medium">{label}</Label>
														<p className="text-xs text-muted">{desc}</p>
													</div>
													<Switch
														isSelected={(defaultPerms as any)[key]}
														onChange={(val: boolean) =>
															setDefaultPerms((prev: any) => ({
																...prev,
																[key]: val,
															}))
														}
														isDisabled={!isOwner}
													>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch>
												</div>
											))}
										</div>

										<div className="flex justify-end pt-4">
											<Button
												variant="primary"
												onPress={handleSavePermissions}
												isPending={isLoading}
												isDisabled={!isOwner}
											>
												Save Permissions
											</Button>
										</div>
									</Tabs.Panel>

									<Tabs.Panel
										id="notifications"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">
												Group Notifications
											</h3>
											<p className="text-muted text-sm">
												Manage how you receive alerts for this group.
											</p>
										</div>

										<div className="space-y-4">
											<div className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface/30">
												<div className="space-y-0.5">
													<Label className="text-sm font-medium">
														Mute Notifications
													</Label>
													<p className="text-xs text-muted">
														Stop receiving all alerts from this group.
													</p>
												</div>
												<Switch
													isSelected={chatSettings.muted}
													onChange={(val: boolean) =>
														updateChatSetting(group.id, "muted", val)
													}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>

											<div
												className={`flex items-center justify-between p-4 border border-border rounded-xl bg-surface/30 transition-opacity ${chatSettings.muted ? "opacity-40 pointer-events-none" : ""}`}
											>
												<div className="space-y-0.5">
													<Label className="text-sm font-medium">
														Mentions Only
													</Label>
													<p className="text-xs text-muted">
														Only notify when someone @mentions you.
													</p>
												</div>
												<Switch
													isSelected={chatSettings.mentionsOnly}
													onChange={(val: boolean) =>
														updateChatSetting(group.id, "mentionsOnly", val)
													}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
										</div>
									</Tabs.Panel>
								</div>
							</Tabs>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>

			{/* Individual Member Permissions Modal */}
			<Modal
				isOpen={memberToEdit !== null}
				onOpenChange={() => setMemberToEdit(null)}
			>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog className="sm:max-w-[400px]">
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Member Permissions</Modal.Heading>
							</Modal.Header>
							<Modal.Body className="space-y-4">
								<div className="space-y-4 pt-2">
									<div className="flex flex-col gap-2">
										<Label className="text-sm font-medium">Role Preset</Label>
										<Surface className="overflow-hidden border border-border rounded-xl">
											<ListBox
												aria-label="Member Role"
												selectedKeys={new Set([memberRole])}
												selectionMode="single"
												onSelectionChange={(keys) => {
													const selected = Array.from(keys)[0] as string;
													if (selected) handleRoleChange(selected);
												}}
												className="w-full"
											>
												<ListBox.Item id="Member" textValue="Member">
													<div className="flex flex-col">
														<Label>Member</Label>
														<Description>
															Standard participant with basic permissions
														</Description>
													</div>
												</ListBox.Item>
												<ListBox.Item id="Moderator" textValue="Moderator">
													<div className="flex flex-col">
														<Label>Moderator</Label>
														<Description>
															Can delete messages and manage members
														</Description>
													</div>
												</ListBox.Item>
												<ListBox.Item id="Admin" textValue="Admin">
													<div className="flex flex-col">
														<Label>Admin</Label>
														<Description>
															Full control over group settings and users
														</Description>
													</div>
												</ListBox.Item>
												<ListBox.Item id="Reader" textValue="Reader">
													<div className="flex flex-col">
														<Label>Reader</Label>
														<Description>
															Can only read messages, cannot send anything
														</Description>
													</div>
												</ListBox.Item>
												<ListBox.Item id="Custom" textValue="Custom">
													<div className="flex flex-col">
														<Label>Custom</Label>
														<Description>
															Individually tailored permissions
														</Description>
													</div>
												</ListBox.Item>
											</ListBox>
										</Surface>
									</div>

									<Separator className="my-4 opacity-50" />

									<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
										Detailed Permissions
									</p>

									{memberPermissions &&
										[
											{ key: "send_messages", label: "Send Messages" },
											{ key: "manage_members", label: "Invite Users" },
											{ key: "pin_messages", label: "Pin Messages" },
											{ key: "delete_messages", label: "Delete Messages" },
											{ key: "rename_group", label: "Rename Group" },
											{
												key: "manage_permissions",
												label: "Manage Permissions",
											},
											{ key: "manage_admins", label: "Manage Admins" },
										].map(({ key, label }) => (
											<div
												key={key}
												className="flex items-center justify-between"
											>
												<Label className="text-sm">{label}</Label>
												<Switch
													isSelected={(memberPermissions as any)[key]}
													onChange={(val: boolean) => {
														setMemberPermissions((prev) =>
															prev ? { ...prev, [key]: val } : null,
														);
														if (memberRole !== "Custom")
															setMemberRole("Custom");
													}}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
										))}
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="secondary"
									onPress={() => setMemberToEdit(null)}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									isPending={isLoading}
									onPress={handleSaveMemberPermissions}
								>
									Save
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>

			<InviteMemberModal
				isOpen={isInviteModalOpen}
				onOpenChange={setIsInviteModalOpen}
				group={group}
			/>
		</Modal>
	);
};
