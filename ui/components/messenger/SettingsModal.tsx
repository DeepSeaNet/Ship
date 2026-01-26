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
    Xmark
} from '@gravity-ui/icons';
import { useState } from 'react';

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
                                        <Tabs.Tab id="security" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Shield className="w-4 h-4 mr-2" />
                                            Security
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="notifications" className="justify-start px-3 py-2 text-sm font-medium">
                                            <Bell className="w-4 h-4 mr-2" />
                                            Notifications
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="billing" className="justify-start px-3 py-2 text-sm font-medium">
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Billing
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
                                            <p className="text-muted">Manage your personal information.</p>
                                        </div>

                                        <div className="flex items-center gap-4 py-4">
                                            <Avatar size="lg" className="w-20 h-20 text-2xl">
                                                <Avatar.Fallback>AD</Avatar.Fallback>
                                            </Avatar>
                                            <div className="space-y-2">
                                                <Button variant="secondary" size="sm">Change Avatar</Button>
                                                <p className="text-xs text-muted">JPG, GIF or PNG. 1MB max.</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-4">
                                            <TextField>
                                                <Label>Display Name</Label>
                                                <Input defaultValue="Admin User" />
                                            </TextField>
                                            <TextField>
                                                <Label>Email</Label>
                                                <Input defaultValue="admin@example.com" />
                                            </TextField>
                                            <div className="space-y-2">
                                                <Label>Bio</Label>
                                                <textarea
                                                    className="w-full p-2 bg-surface border border-border rounded-lg text-sm min-h-[100px] outline-none focus:border-primary transition-colors"
                                                    placeholder="Tell us about yourself"
                                                />
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

                                    <Tabs.Panel id="billing" className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1">Billing</h3>
                                            <p className="text-muted">Manage your subscription.</p>
                                        </div>

                                        <div className="p-6 border border-border rounded-xl bg-surface/30">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-bold text-lg">Pro Plan</h4>
                                                    <p className="text-sm text-muted">$12/month, billed yearly</p>
                                                </div>
                                                <span className="px-2 py-1 rounded-full bg-success/20 text-success text-xs font-bold">Active</span>
                                            </div>
                                            <Button variant="secondary" className="w-full">Manage Subscription</Button>
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
