"use client";
import {
	Bell,
	Database,
	Display,
	Palette,
	Person,
	Shield,
	Xmark,
} from "@gravity-ui/icons";
import { Button, Modal, Tabs } from "@heroui/react";
import { useAppearanceSettings } from "@/hooks/useAppearanceSettings";
import { AccountPanel } from "./AccountPanel";
import { AppearancePanel } from "./AppearancePanel";
import { DevicesPanel } from "./DevicesPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { SecurityPanel } from "./SecurityPanel";
import { StoragePanel } from "./StoragePanel";

interface SettingsModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

const TAB_ITEMS = [
	{ id: "account", label: "Account", icon: <Person className="w-4 h-4 mr-2" /> },
	{ id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4 mr-2" /> },
	{ id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4 mr-2" /> },
	{ id: "security", label: "Security", icon: <Shield className="w-4 h-4 mr-2" /> },
	{ id: "devices", label: "Devices", icon: <Display className="w-4 h-4 mr-2" /> },
	{ id: "storage", label: "Storage", icon: <Database className="w-4 h-4 mr-2" /> },
] as const;

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
	const appearanceProps = useAppearanceSettings();

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
									<h2 className="text-xl font-bold px-2 mb-6 ml-1">
										Settings
									</h2>
									<Tabs.List
										aria-label="Settings categories"
										className="flex flex-col gap-2 w-full"
									>
										{TAB_ITEMS.map(({ id, label, icon }) => (
											<Tabs.Tab
												key={id}
												id={id}
												className="justify-start px-3 py-2 text-sm font-medium"
											>
												{icon}
												{label}
												<Tabs.Indicator />
											</Tabs.Tab>
										))}
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
										id="account"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<AccountPanel />
									</Tabs.Panel>

									<Tabs.Panel
										id="appearance"
										className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<AppearancePanel {...appearanceProps} />
									</Tabs.Panel>

									<Tabs.Panel
										id="notifications"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<NotificationsPanel />
									</Tabs.Panel>

									<Tabs.Panel
										id="security"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<SecurityPanel />
									</Tabs.Panel>

									<Tabs.Panel
										id="devices"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<DevicesPanel />
									</Tabs.Panel>

									<Tabs.Panel
										id="storage"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<StoragePanel />
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
