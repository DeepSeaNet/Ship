'use client';

import {
    Modal,
    Tabs,
    Avatar,
    Button,
    TextField,
    Input,
    Switch,
    Label,
    Separator
} from '@heroui/react';
import {
    Person,
    Shield,
    Bell,
    CreditCard,
    Xmark,
    Palette,
    Database,
    ArrowRightFromSquare,
    ArrowDownToLine,
    Copy,
    TrashBin
} from '@gravity-ui/icons';
import { useState, useEffect } from 'react';
import { toast } from '@heroui/react';

interface SettingsModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
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
                            >
                                <Tabs.ListContainer className="w-64 border-r border-border h-full bg-surface/50 p-4 shrink-0">
                                    <h2 className="text-xl font-bold px-2 mb-6 ml-1">Settings</h2>
                                    <Tabs.List aria-label="Settings categories" className="flex flex-col gap-2 w-full">
                                        <Tabs.Tab id="account" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Person className="w-4 h-4 mr-2" />
                                            Account
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="appearance" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Palette className="w-4 h-4 mr-2" />
                                            Appearance
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="notifications" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Bell className="w-4 h-4 mr-2" />
                                            Notifications
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="security" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Shield className="w-4 h-4 mr-2" />
                                            Security
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="storage" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Database className="w-4 h-4 mr-2" />
                                            Storage
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

                                    <Tabs.Panel id="account" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Account</h3>
                                            <p className="text-muted text-sm">Manage your personal information and session.</p>
                                        </div>

                                        <div className="flex items-center gap-6 py-2">
                                            <Avatar size="lg" className="w-24 h-24 text-3xl font-bold bg-accent/20 text-accent">
                                                <Avatar.Fallback>
                                                    {typeof window !== 'undefined' ? (localStorage.getItem('username')?.slice(0, 1).toUpperCase() || 'U') : 'U'}
                                                </Avatar.Fallback>
                                            </Avatar>
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" size="sm">Change Avatar</Button>
                                                    <Button variant="ghost" size="sm" className="text-danger">Remove</Button>
                                                </div>
                                                <p className="text-xs text-muted">JPG, GIF or PNG. 1MB max.</p>
                                            </div>
                                        </div>

                                        <Separator className="opacity-50" />

                                        <div className="grid gap-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <TextField isReadOnly>
                                                    <Label>Username</Label>
                                                    <div className="relative group/field">
                                                        <Input value={typeof window !== 'undefined' ? localStorage.getItem('username') || '' : ''} className="pr-10" />
                                                        <Button variant="ghost" isIconOnly size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                            onPress={() => {
                                                                navigator.clipboard.writeText(localStorage.getItem('username') || '');
                                                                toast('Copied Username', { variant: 'success' });
                                                            }}
                                                        >
                                                            <Copy className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TextField>
                                                <TextField isReadOnly>
                                                    <Label>User ID</Label>
                                                    <div className="relative group/field">
                                                        <Input value={typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''} className="pr-10" />
                                                        <Button variant="ghost" isIconOnly size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                            onPress={() => {
                                                                navigator.clipboard.writeText(localStorage.getItem('userId') || '');
                                                                toast('Copied User ID', { variant: 'success' });
                                                            }}
                                                        >
                                                            <Copy className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TextField>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <TextField isReadOnly>
                                                    <Label>Public Address</Label>
                                                    <div className="relative group/field">
                                                        <Input value={typeof window !== 'undefined' ? localStorage.getItem('publicAddress') || '' : ''} className="pr-10" />
                                                        <Button variant="ghost" isIconOnly size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                            onPress={() => {
                                                                navigator.clipboard.writeText(localStorage.getItem('publicAddress') || '');
                                                                toast('Copied Public Address', { variant: 'success' });
                                                            }}
                                                        >
                                                            <Copy className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TextField>

                                                <TextField isReadOnly>
                                                    <Label>Server Address</Label>
                                                    <div className="relative group/field">
                                                        <Input value={typeof window !== 'undefined' ? localStorage.getItem('serverAddress') || '' : ''} className="pr-10" />
                                                        <Button variant="ghost" isIconOnly size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
                                                            onPress={() => {
                                                                navigator.clipboard.writeText(localStorage.getItem('serverAddress') || '');
                                                                toast('Copied Server Address', { variant: 'success' });
                                                            }}
                                                        >
                                                            <Copy className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TextField>
                                            </div>
                                        </div>

                                        <Separator className="opacity-50" />

                                        <div className="flex flex-col gap-3 pt-2">
                                            <h4 className="font-semibold text-sm">Account Actions</h4>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="secondary"
                                                    className="flex-1 min-w-[140px]"
                                                    onPress={() => toast('Account export started', { variant: 'success' })}
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
                                    </Tabs.Panel>

                                    <Tabs.Panel id="appearance" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Appearance</h3>
                                            <p className="text-muted text-sm">Customize how the application looks.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="font-semibold text-sm">Interface Theme</h4>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Button
                                                        variant="secondary"
                                                        className={`flex flex-col items-center gap-2 h-auto py-4 border-2 ${typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'border-primary' : 'border-transparent'}`}
                                                        onPress={() => {
                                                            document.documentElement.classList.add('dark');
                                                            localStorage.setItem('theme', 'dark');
                                                            toast('Switched to Dark theme', { variant: 'success' });
                                                        }}
                                                    >
                                                        <div className="w-full h-12 bg-neutral-900 rounded-md border border-neutral-700" />
                                                        <span className="text-xs">Dark</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className={`flex flex-col items-center gap-2 h-auto py-4 border-2 ${typeof document !== 'undefined' && !document.documentElement.classList.contains('dark') ? 'border-primary' : 'border-transparent'}`}
                                                        onPress={() => {
                                                            document.documentElement.classList.remove('dark');
                                                            localStorage.setItem('theme', 'light');
                                                            toast('Switched to Light theme', { variant: 'success' });
                                                        }}
                                                    >
                                                        <div className="w-full h-12 bg-white rounded-md border border-neutral-200" />
                                                        <span className="text-xs">Light</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="flex flex-col items-center gap-2 h-auto py-4 border-2 border-transparent"
                                                        onPress={() => {
                                                            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                                            document.documentElement.classList.toggle('dark', isDark);
                                                            localStorage.removeItem('theme');
                                                            toast('Switched to System theme', { variant: 'success' });
                                                        }}
                                                    >
                                                        <div className="w-full h-12 bg-gradient-to-br from-neutral-800 to-white rounded-md border border-neutral-400" />
                                                        <span className="text-xs">System</span>
                                                    </Button>
                                                </div>
                                            </div>

                                            <Separator className="opacity-50" />

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <span className="font-medium">Glassmorphism</span>
                                                    <p className="text-xs text-muted">Apply subtle glass effects to the UI.</p>
                                                </div>
                                                <Switch defaultSelected />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <span className="font-medium">Modern Shadows</span>
                                                    <p className="text-xs text-muted">Use high-quality elevation shadows.</p>
                                                </div>
                                                <Switch defaultSelected />
                                            </div>
                                        </div>
                                    </Tabs.Panel>

                                    <Tabs.Panel id="security" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Security</h3>
                                            <p className="text-muted">Keep your account secure.</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                                                <div className="space-y-0.5">
                                                    <span className="font-medium">Two-factor Authentication</span>
                                                    <p className="text-xs text-muted">Add an extra layer of security.</p>
                                                </div>
                                                <Switch />
                                            </div>

                                            <div className="space-y-4 pt-4">
                                                <h4 className="font-medium">Change Password</h4>
                                                <TextField>
                                                    <Label>Current Password</Label>
                                                    <Input type="password" />
                                                </TextField>
                                                <TextField>
                                                    <Label>New Password</Label>
                                                    <Input type="password" />
                                                </TextField>
                                                <Button className="w-fit">Update Password</Button>
                                            </div>
                                        </div>
                                    </Tabs.Panel>

                                    <Tabs.Panel id="notifications" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Notifications</h3>
                                            <p className="text-muted">Manage how you receive alerts.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="font-medium border-b border-border pb-2">Messages</h4>
                                                <div className="flex items-center justify-between">
                                                    <Label>Direct Messages</Label>
                                                    <Switch defaultSelected />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Label>Group Mentions</Label>
                                                    <Switch defaultSelected />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="font-medium border-b border-border pb-2">System</h4>
                                                <div className="flex items-center justify-between">
                                                    <Label>Security Alerts</Label>
                                                    <Switch defaultSelected isDisabled />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Label>Product Updates</Label>
                                                    <Switch />
                                                </div>
                                            </div>
                                        </div>
                                    </Tabs.Panel>


                                    <Tabs.Panel id="storage" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Storage</h3>
                                            <p className="text-muted text-sm">Manage data usage and local storage.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-4 border border-border rounded-xl bg-surface/30 flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-sm">Media Cache</h4>
                                                    <p className="text-xs text-muted">Currently using 142 MB</p>
                                                </div>
                                                <Button variant="ghost" size="sm" className="text-danger">
                                                    <TrashBin className="size-4 mr-2" />
                                                    Clear Cache
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="font-semibold text-sm">Auto-Download</h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm">Photos</Label>
                                                        <Switch defaultSelected />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm">Videos</Label>
                                                        <Switch />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm">Files</Label>
                                                        <Switch />
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator className="opacity-50" />

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <span className="font-medium">Save to Gallery</span>
                                                    <p className="text-xs text-muted">Automatically save incoming photos to system gallery.</p>
                                                </div>
                                                <Switch />
                                            </div>
                                        </div>
                                    </Tabs.Panel>
                                </div>
                            </Tabs>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
