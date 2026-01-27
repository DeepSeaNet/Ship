'use client';

import {
    Modal,
    Avatar,
    Button,
    Input,
    TextField,
    Label,
    toast,
} from '@heroui/react';
import {
    Xmark,
    Magnifier,
    PersonPlus,
} from '@gravity-ui/icons';
import { useState, useMemo } from 'react';
import { useGroups } from '@/hooks/useGroups';
import { useContacts } from '@/hooks/useContacts';
import { Chat } from '@/hooks/messengerTypes';

interface InviteMemberModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    group: Chat;
}

export function InviteMemberModal({ isOpen, onOpenChange, group }: InviteMemberModalProps) {
    const { inviteUserToGroup, checkPermission } = useGroups();
    const { contacts, loading: contactsLoading } = useContacts();

    const canManageMembers = checkPermission(group, 'manage_members');
    const [inviteMethod, setInviteMethod] = useState<'contacts' | 'id'>('contacts');
    const [invitingUserId, setInvitingUserId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const handleInvite = async (userId?: number) => {
        const idToInvite = userId || parseInt(invitingUserId);
        if (!idToInvite || isNaN(idToInvite)) return;

        setIsInviting(true);
        const success = await inviteUserToGroup(group.id, idToInvite);
        setIsInviting(false);
        if (success) {
            setInvitingUserId('');
            toast(`User ${idToInvite} invited`, { variant: 'success' });
            if (inviteMethod === 'id') {
                onOpenChange(false);
            }
        }
    };

    const filteredContacts = useMemo(() => {
        return contacts.filter(c =>
            c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.user_id.toString().includes(searchQuery)
        );
    }, [contacts, searchQuery]);

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="w-[450px] h-[600px] flex flex-col bg-overlay rounded-3xl overflow-hidden border border-border shadow-2xl">
                        <Modal.CloseTrigger className="right-4 top-4" />
                        <Modal.Header className="pt-8 px-8 pb-4 border-none">
                            <Modal.Heading className="flex items-center gap-3 text-2xl font-bold">
                                <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
                                    <PersonPlus className="w-6 h-6 text-accent" />
                                </div>
                                Invite Members
                            </Modal.Heading>
                            <p className="text-sm text-muted mt-2">Add people to {group.name}</p>
                        </Modal.Header>
                        <Modal.Body className="flex-1 px-8 py-4 space-y-6 overflow-hidden flex flex-col">
                            <div className="flex bg-surface/40 p-1 rounded-xl w-full border border-border/10 shrink-0">
                                <Button
                                    size="sm"
                                    variant={inviteMethod === 'contacts' ? 'secondary' : 'ghost'}
                                    onPress={() => setInviteMethod('contacts')}
                                    className={`flex-1 h-10 rounded-lg transition-all ${inviteMethod === 'contacts' ? 'shadow-sm font-semibold' : 'text-muted hover:text-foreground'}`}
                                >
                                    My Contacts
                                </Button>
                                <Button
                                    size="sm"
                                    variant={inviteMethod === 'id' ? 'secondary' : 'ghost'}
                                    onPress={() => setInviteMethod('id')}
                                    className={`flex-1 h-10 rounded-lg transition-all ${inviteMethod === 'id' ? 'shadow-sm font-semibold' : 'text-muted hover:text-foreground'}`}
                                >
                                    Invite by ID
                                </Button>
                            </div>

                            {inviteMethod === 'id' ? (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <TextField className="w-full">
                                        <Label className="text-sm font-medium mb-1.5 ml-1">Member ID</Label>
                                        <Input
                                            placeholder="Enter 12-digit user ID"
                                            value={invitingUserId}
                                            onChange={(e) => setInvitingUserId(e.target.value)}
                                            className="h-12 bg-surface/30 border-border/50 focus:border-accent text-lg"
                                        />
                                    </TextField>
                                    <div className="pt-4">
                                        <Button
                                            variant="primary"
                                            className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-accent/20"
                                            onPress={() => handleInvite()}
                                            isPending={isInviting}
                                            isDisabled={!invitingUserId}
                                        >
                                            Send Invite
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1 min-h-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <TextField className="w-full shrink-0">
                                        <div className="relative">
                                            <Magnifier className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                            <Input
                                                placeholder="Name or ID..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                size={32.5}
                                                className="h-11 pl-10 bg-surface/30 border-border/50 rounded-xl"
                                            />
                                        </div>
                                    </TextField>

                                    <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 custom-scrollbar scrollbar-hide">
                                        {contactsLoading ? (
                                            <div className="h-full flex flex-col items-center justify-center py-10 opacity-50">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent mb-2" />
                                                <p className="text-sm font-medium">Looking for friends...</p>
                                            </div>
                                        ) : filteredContacts.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center py-10 text-center px-6">
                                                <div className="w-16 h-16 rounded-full bg-surface/50 mb-4 flex items-center justify-center">
                                                    <Magnifier className="w-8 h-8 text-muted/30" />
                                                </div>
                                                <p className="font-semibold text-muted">No one found</p>
                                                <p className="text-xs text-muted/60 mt-1">Try a different name or invite by their full ID directly</p>
                                            </div>
                                        ) : (
                                            filteredContacts.map(contact => {
                                                const isMember = group.members?.includes(contact.user_id);
                                                return (
                                                    <div key={contact.user_id} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-surface/50 transition-all group/item">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar size="md" className="ring-2 ring-transparent group-hover/item:ring-accent/20 transition-all">
                                                                {contact.avatar && <Avatar.Image src={contact.avatar} />}
                                                                <Avatar.Fallback className="bg-gradient-to-br from-accent/20 to-accent/5 text-accent font-bold">
                                                                    {contact.username.slice(0, 1).toUpperCase()}
                                                                </Avatar.Fallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="text-sm font-bold leading-tight">{contact.username}</p>
                                                                <p className="text-[11px] text-muted font-mono mt-0.5 opacity-60 group-hover/item:opacity-100 transition-opacity">#{contact.user_id}</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant={isMember ? 'ghost' : 'ghost'}
                                                            className={`h-9 px-4 text-xs font-bold rounded-xl transition-all ${isMember ? 'text-muted opacity-50 cursor-default' : 'text-accent hover:bg-accent/10 hover:scale-105 active:scale-95'}`}
                                                            onPress={() => !isMember && handleInvite(contact.user_id)}
                                                            isDisabled={isMember}
                                                        >
                                                            {isMember ? 'Already in' : 'Invite'}
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="px-8 pb-8 pt-2 border-none">
                            <Button variant="ghost" className="w-full h-11 text-muted hover:text-foreground hover:bg-surface/50 rounded-xl font-medium" onPress={() => onOpenChange(false)}>
                                Done
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
