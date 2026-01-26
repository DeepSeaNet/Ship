'use client';

import { useState } from 'react';
import { Button, Modal, Input, TextArea, Select, TextField, Label, ListBox } from '@heroui/react';
import { Persons, Lock, Globe, ListCheck, ChevronDown } from '@gravity-ui/icons';
import { useGroups } from '@/hooks/useGroups';

interface CreateGroupModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSuccess?: () => void;
}

export function CreateGroupModal({ isOpen, onOpenChange, onSuccess }: CreateGroupModalProps) {
    const { createGroup, loading } = useGroups();
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private'>('private');
    const [joinMode, setJoinMode] = useState<'invite_only' | 'request_to_join' | 'open'>('invite_only');

    const handleCreate = async () => {
        if (!groupName.trim()) return;

        const success = await createGroup(groupName, {
            description,
            visibility,
            joinMode,
        });

        if (success) {
            onOpenChange(false);
            setGroupName('');
            setDescription('');
            onSuccess?.();
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[420px]">
                        <Modal.CloseTrigger />
                        <Modal.Header className="px-1 pt-2">
                            <Modal.Icon className="bg-accent/10 text-accent">
                                <Persons className="size-5" />
                            </Modal.Icon>
                            <Modal.Heading>Create New Group</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4 px-1">
                            <TextField isRequired>
                                <Label>Group Name</Label>
                                <Input
                                    placeholder="Enter group name"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    variant='secondary'
                                />
                            </TextField>

                            <TextField>
                                <Label>Description</Label>
                                <TextArea
                                    placeholder="What's this group about?"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    variant='secondary'
                                />
                            </TextField>

                            <div className="grid grid-cols-1 gap-4">
                                <Select
                                    selectedKey={visibility}
                                    onSelectionChange={(key) => setVisibility(key as any)}
                                    variant='secondary'
                                >
                                    <Label>Visibility</Label>
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator>
                                            <ChevronDown className="size-4" />
                                        </Select.Indicator>
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            <ListBox.Item id="private" textValue="Private">
                                                <div className="flex items-center gap-2">
                                                    <Lock className="size-4" />
                                                    <span>Private</span>
                                                </div>
                                            </ListBox.Item>
                                            <ListBox.Item id="public" textValue="Public">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="size-4" />
                                                    <span>Public</span>
                                                </div>
                                            </ListBox.Item>
                                        </ListBox>
                                    </Select.Popover>
                                </Select>

                                <Select
                                    selectedKey={joinMode}
                                    onSelectionChange={(key) => setJoinMode(key as any)}
                                    variant='secondary'
                                >
                                    <Label>Join Mode</Label>
                                    <Select.Trigger>
                                        <Select.Value />
                                        <Select.Indicator>
                                            <ChevronDown className="size-4" />
                                        </Select.Indicator>
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            <ListBox.Item id="invite_only" textValue="Invite Only">
                                                <div className="flex items-center gap-2">
                                                    <Lock className="size-4" />
                                                    <span>Invite Only</span>
                                                </div>
                                            </ListBox.Item>
                                            <ListBox.Item id="request_to_join" textValue="Request to Join">
                                                <div className="flex items-center gap-2">
                                                    <ListCheck className="size-4" />
                                                    <span>Request to Join</span>
                                                </div>
                                            </ListBox.Item>
                                            <ListBox.Item id="open" textValue="Open">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="size-4" />
                                                    <span>Open</span>
                                                </div>
                                            </ListBox.Item>
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="px-8 pb-8">
                            <div className="flex w-full gap-2">
                                <Button
                                    variant="secondary"
                                    onPress={() => onOpenChange(false)}
                                    isDisabled={loading}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onPress={handleCreate}
                                    isPending={loading}
                                    isDisabled={!groupName.trim()}
                                    className="flex-1"
                                >
                                    Create Group
                                </Button>
                            </div>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
