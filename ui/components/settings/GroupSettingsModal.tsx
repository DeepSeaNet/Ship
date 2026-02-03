'use client';

import {
    Modal,
    Tabs,
    Avatar,
    Button,
    TextField,
    Input,
    TextArea,
    Switch,
    Label,
    Separator,
    toast,
} from '@heroui/react';
import {
    Person,
    Shield,
    Xmark,
    TrashBin,
    Gear,
    Copy,
    ChevronDown,
    PersonPlus,
    Lock,
    Globe,
    Magnifier,
} from '@gravity-ui/icons';
import { useState, useEffect, useCallback } from 'react';
import { useGroups } from '@/hooks/useGroups';
import { Chat, Member, Permissions } from '@/hooks/messengerTypes';
import { useMessengerState } from '@/hooks/useMessengerState';
import { InviteMemberModal } from './InviteMemberModal';

interface GroupSettingsModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    group: Chat;
}

export function GroupSettingsModal({ isOpen, onOpenChange, group }: GroupSettingsModalProps) {
    const {
        updateGroupConfig,
        removeUserFromGroup,
        inviteUserToGroup,
        checkPermission,
        updateMemberPermissions
    } = useGroups();
    const { users } = useMessengerState();

    // State for general settings
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description || '');
    const [visibility, setVisibility] = useState(group.group_config?.visibility?.toLowerCase() || 'private');
    const [joinMode, setJoinMode] = useState(group.group_config?.join_mode?.toLowerCase() || 'invite_only');
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
    const [memberPermissions, setMemberPermissions] = useState<Permissions | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Sync state if group changes
    useEffect(() => {
        setName(group.name);
        setDescription(group.description || '');
        setVisibility(group.group_config?.visibility?.toLowerCase() || 'private');
        setJoinMode(group.group_config?.join_mode?.toLowerCase() || 'invite_only');
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
        if (success) {
            toast('Group settings saved', { variant: 'success' });
        }
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
        if (success) {
            toast('Default permissions saved', { variant: 'success' });
        }
    };

    const isOwner = group.owner_id?.toString() === localStorage.getItem('userId');
    const canManageMembers = checkPermission(group, 'manage_members');
    const canRename = checkPermission(group, 'rename_group');
    const canManagePermissions = checkPermission(group, 'manage_permissions');

    const openMemberPermissionEdit = (memberId: number) => {
        setMemberToEdit(memberId);
        // Get current permissions for this member
        const currentPerms = group.users_permissions?.[memberId] || group.default_permissions || defaultPerms;
        setMemberPermissions({ ...currentPerms });
    };

    const handleSaveMemberPermissions = async () => {
        if (memberToEdit === null || !memberPermissions) return;
        setIsLoading(true);
        const success = await updateMemberPermissions(group.id, memberToEdit, memberPermissions);
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
                                    <h2 className="text-xl font-bold px-2 mb-6 ml-1 truncate">{group.name}</h2>
                                    <Tabs.List aria-label="Group settings categories" className="flex flex-col gap-2 w-full">
                                        <Tabs.Tab id="general" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Gear className="w-4 h-4 mr-2" />
                                            General
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="members" className="justify-start px-3 py-2 text-sm font-medium">
                                            <PersonPlus className="w-4 h-4 mr-2" />
                                            Members
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="permissions" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Shield className="w-4 h-4 mr-2" />
                                            Permissions
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

                                    <Tabs.Panel id="general" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">General Settings</h3>
                                            <p className="text-muted text-sm">Configure basic group information and appearance.</p>
                                        </div>

                                        <div className="flex items-center gap-6 py-2">
                                            <Avatar size="lg" className="w-24 h-24 text-3xl font-bold bg-accent/20 text-accent">
                                                {group.avatar && <Avatar.Image src={group.avatar} />}
                                                <Avatar.Fallback>
                                                    {group.name.slice(0, 1).toUpperCase()}
                                                </Avatar.Fallback>
                                            </Avatar>
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" size="sm" isDisabled={!canRename}>Change Avatar</Button>
                                                    <Button variant="ghost" size="sm" className="text-danger" isDisabled={!canRename}>Remove</Button>
                                                </div>
                                                <p className="text-xs text-muted">JPG, GIF or PNG. 1MB max.</p>
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
                                                isDisabled={!canRename || (name === group.name && description === group.description)}
                                            >
                                                Save Changes
                                            </Button>
                                        </div>
                                    </Tabs.Panel>

                                    <Tabs.Panel id="members" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-2xl font-bold mb-1">Members</h3>
                                                <p className="text-muted text-sm">Manage group participants and roles.</p>
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
                                            {group.members?.map(memberId => {
                                                const member = users[memberId.toString()];
                                                const isSelf = memberId.toString() === localStorage.getItem('userId');
                                                const isAdmin = group.admins?.includes(memberId);
                                                const isOwnerOfGroup = group.owner_id === memberId;

                                                return (
                                                    <div key={memberId} className="flex items-center justify-between p-3 border border-border rounded-xl bg-surface/30">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar size="sm">
                                                                {member?.avatar && <Avatar.Image src={member.avatar} />}
                                                                <Avatar.Fallback>{(member?.name || 'U').slice(0, 1).toUpperCase()}</Avatar.Fallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="text-sm font-medium">{member?.name || `User ${memberId}`} {isSelf && '(You)'}</p>
                                                                <p className="text-xs text-muted">
                                                                    {isOwnerOfGroup ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {canManagePermissions && !isOwnerOfGroup && (
                                                                <Button
                                                                    variant="ghost"
                                                                    isIconOnly
                                                                    size="sm"
                                                                    className="text-muted hover:bg-surface"
                                                                    onPress={() => openMemberPermissionEdit(memberId)}
                                                                >
                                                                    <Shield className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            {!isOwnerOfGroup && !isSelf && canManageMembers && (
                                                                <Button
                                                                    variant="ghost"
                                                                    isIconOnly
                                                                    size="sm"
                                                                    className="text-danger hover:bg-danger/10"
                                                                    onPress={() => removeUserFromGroup(group.id, memberId)}
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

                                    <Tabs.Panel id="permissions" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Default Permissions</h3>
                                            <p className="text-muted text-sm">Set what new members can do by default.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {[
                                                { key: 'send_messages', label: 'Send Messages', desc: 'Allow members to send text messages.' },
                                                { key: 'manage_members', label: 'Invite Users', desc: 'Allow members to invite new participants.' },
                                                { key: 'pin_messages', label: 'Pin Messages', desc: 'Allow members to pin important messages.' },
                                                { key: 'delete_messages', label: 'Delete Messages', desc: 'Allow members to delete any message.' },
                                                { key: 'rename_group', label: 'Rename Group', desc: 'Allow members to change group name and avatar.' },
                                                { key: 'allow_stickers', label: 'Stickers', desc: 'Allow sending stickers.' },
                                                { key: 'allow_gifs', label: 'GIFs', desc: 'Allow sending GIFs.' },
                                            ].map(({ key, label, desc }) => (
                                                <div key={key} className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <Label className="font-medium">{label}</Label>
                                                        <p className="text-xs text-muted">{desc}</p>
                                                    </div>
                                                    <Switch
                                                        isSelected={(defaultPerms as any)[key]}
                                                        onChange={(val: boolean) => setDefaultPerms(prev => ({ ...prev, [key]: val }))}
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
                                </div>
                            </Tabs>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            {/* Individual Member Permissions Modal */}
            <Modal isOpen={memberToEdit !== null} onOpenChange={() => setMemberToEdit(null)}>
                <Modal.Backdrop>
                    <Modal.Container>
                        <Modal.Dialog className="sm:max-w-[400px]">
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>Member Permissions</Modal.Heading>
                            </Modal.Header>
                            <Modal.Body className="space-y-4">
                                {memberPermissions && [
                                    { key: 'send_messages', label: 'Send Messages' },
                                    { key: 'manage_members', label: 'Invite Users' },
                                    { key: 'pin_messages', label: 'Pin Messages' },
                                    { key: 'delete_messages', label: 'Delete Messages' },
                                    { key: 'rename_group', label: 'Rename Group' },
                                ].map(({ key, label }) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <Label className="text-sm">{label}</Label>
                                        <Switch
                                            isSelected={(memberPermissions as any)[key]}
                                            onChange={(val: boolean) => setMemberPermissions(prev => prev ? ({ ...prev, [key]: val }) : null)}
                                        >
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                        </Switch>
                                    </div>
                                ))}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button variant="secondary" onPress={() => setMemberToEdit(null)}>Cancel</Button>
                                <Button variant="primary" isPending={isLoading} onPress={handleSaveMemberPermissions}>Save</Button>
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
}
