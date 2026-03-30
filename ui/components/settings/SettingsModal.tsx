"use client";
import {
	ArrowDownToLine,
	ArrowRightFromSquare,
	Bell,
	Check,
	Copy,
	Database,
	Display,
	MagicWand,
	Palette,
	Person,
	Shield,
	TrashBin,
	Xmark,
} from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Card,
	Input,
	Label,
	ListBox,
	Modal,
	Select,
	Separator,
	Slider,
	Switch,
	Tabs,
	TextField,
	Tooltip,
	toast,
	type Key,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { ExportAccountModal } from "../settings/ExportAccountModal";
import { getUserDevices } from "@/hooks/generated";

function DevicesPanelContent() {
	const [devices, setDevices] = useState<
		{ device_id: string; created_at: number }[]
	>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadDevices = async () => {
			try {
				const deps = await getUserDevices();
				setDevices(deps);
			} catch (err) {
				console.error("Failed to load devices:", err);
				toast(`Failed to load devices: ${err}`, { variant: "danger" });
			} finally {
				setLoading(false);
			}
		};
		loadDevices();
	}, []);

	const handleDelete = (id: string) => {
		toast(`Device deleted (placeholder)`, { variant: "success" });
		setDevices((prev) => prev.filter((d) => d.device_id !== id));
	};

	if (loading)
		return <div className="text-sm text-muted">Loading devices...</div>;
	if (devices.length === 0)
		return <div className="text-sm text-muted">No devices found.</div>;

	return (
		<div className="space-y-4">
			{devices.map((device) => (
				<Card
					key={device.device_id}
					className="p-4 border border-border bg-surface/30"
				>
					<div className="flex items-center justify-between">
						<div>
							<h4 className="font-semibold text-sm">
								Device {device.device_id}
							</h4>
							<p className="text-xs text-muted">
								Signed in{" "}
								{new Date(device.created_at * 1000).toLocaleDateString()}
							</p>
						</div>
						<Button
							size="sm"
							variant="ghost"
							className="text-danger hover:bg-danger/10"
							onPress={() => handleDelete(device.device_id)}
						>
							<TrashBin className="size-4 mr-2" />
							Delete
						</Button>
					</div>
				</Card>
			))}
		</div>
	);
}

interface SettingsModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
	const [isExportModalOpen, setIsExportModalOpen] = useState(false);
	const {
		settings: notifSettings,
		updateSetting: updateNotif,
		resetSettings: resetNotif,
	} = useNotificationSettings();

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
									<Tabs.List
										aria-label="Settings categories"
										className="flex flex-col gap-2 w-full"
									>
										<Tabs.Tab
											id="account"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Person className="w-4 h-4 mr-2" />
											Account
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="appearance"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Palette className="w-4 h-4 mr-2" />
											Appearance
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
										<Tabs.Tab
											id="security"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Shield className="w-4 h-4 mr-2" />
											Security
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="devices"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
											<Display className="w-4 h-4 mr-2" />
											Devices
											<Tabs.Indicator />
										</Tabs.Tab>
										<Tabs.Tab
											id="storage"
											className="justify-start px-3 py-2 text-sm font-medium"
										>
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

									<Tabs.Panel
										id="account"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">Account</h3>
											<p className="text-muted text-sm">
												Manage your personal information and session.
											</p>
										</div>

										<div className="flex items-center gap-6 py-2">
											<Avatar
												size="lg"
												className="w-24 h-24 text-3xl font-bold bg-accent/20 text-accent"
											>
												<Avatar.Fallback>
													{typeof window !== "undefined"
														? localStorage
																.getItem("username")
																?.slice(0, 1)
																.toUpperCase() || "U"
														: "U"}
												</Avatar.Fallback>
											</Avatar>
											<div className="space-y-3">
												<div className="flex gap-2">
													<Button variant="secondary" size="sm">
														Change Avatar
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="text-danger"
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

										<div className="grid gap-6">
											<div className="grid grid-cols-2 gap-4">
												<TextField isReadOnly>
													<Label>Username</Label>
													<div className="relative group/field">
														<Input
															value={
																typeof window !== "undefined"
																	? localStorage.getItem("username") || ""
																	: ""
															}
															className="pr-10"
														/>
														<Button
															variant="ghost"
															isIconOnly
															size="sm"
															className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
															onPress={() => {
																navigator.clipboard.writeText(
																	localStorage.getItem("username") || "",
																);
																toast("Copied Username", {
																	variant: "success",
																});
															}}
														>
															<Copy className="size-4" />
														</Button>
													</div>
												</TextField>
												<TextField isReadOnly>
													<Label>User ID</Label>
													<div className="relative group/field">
														<Input
															value={
																typeof window !== "undefined"
																	? localStorage.getItem("userId") || ""
																	: ""
															}
															className="pr-10"
														/>
														<Button
															variant="ghost"
															isIconOnly
															size="sm"
															className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
															onPress={() => {
																navigator.clipboard.writeText(
																	localStorage.getItem("userId") || "",
																);
																toast("Copied User ID", { variant: "success" });
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
														<Input
															value={
																typeof window !== "undefined"
																	? localStorage.getItem("publicAddress") || ""
																	: ""
															}
															className="pr-10"
														/>
														<Button
															variant="ghost"
															isIconOnly
															size="sm"
															className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
															onPress={() => {
																navigator.clipboard.writeText(
																	localStorage.getItem("publicAddress") || "",
																);
																toast("Copied Public Address", {
																	variant: "success",
																});
															}}
														>
															<Copy className="size-4" />
														</Button>
													</div>
												</TextField>

												<TextField isReadOnly>
													<Label>Server Address</Label>
													<div className="relative group/field">
														<Input
															value={
																typeof window !== "undefined"
																	? localStorage.getItem("serverAddress") || ""
																	: ""
															}
															className="pr-10"
														/>
														<Button
															variant="ghost"
															isIconOnly
															size="sm"
															className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-opacity"
															onPress={() => {
																navigator.clipboard.writeText(
																	localStorage.getItem("serverAddress") || "",
																);
																toast("Copied Server Address", {
																	variant: "success",
																});
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
									</Tabs.Panel>

									<Tabs.Panel
										id="appearance"
										className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div className="bg-surface/30 border border-border/50 rounded-2xl p-6 mb-4">
											<div className="flex gap-4 items-start">
												<Avatar className="size-10 shrink-0">
													<Avatar.Image src="/avatar.png" />
													<Avatar.Fallback>U</Avatar.Fallback>
												</Avatar>
												<div className="space-y-2 flex-1">
													<div className="flex items-center gap-2">
														<span className="font-bold text-sm">
															Preview User
														</span>
														<span className="text-[10px] text-muted">
															12:34 PM
														</span>
													</div>
													<Card className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tl-none max-w-sm shadow-lg shadow-primary/20">
														<p className="text-sm">
															How do you like the new theme? Everything looks so
															much more alive! ✨
														</p>
													</Card>
												</div>
											</div>
										</div>

										<div>
											<h3 className="text-2xl font-bold mb-1">Appearance</h3>
											<p className="text-muted text-sm">
												Customize the interface to match your style.
											</p>
										</div>

										{/* Theme Selection */}
										<div className="space-y-4">
											<h4 className="font-semibold text-sm flex items-center gap-2">
												<Display className="size-4" /> Interface Theme
											</h4>
											<div className="grid grid-cols-3 gap-4">
												{[
													{
														id: "light",
														name: "Light",
														bg: "bg-white",
														text: "text-neutral-900",
														border: "border-neutral-200",
													},
													{
														id: "dark",
														name: "Dark",
														bg: "bg-neutral-900",
														text: "text-white",
														border: "border-neutral-700",
													},
													{
														id: "terminal",
														name: "Terminal",
														bg: "bg-[#0a0f0a]",
														text: "text-[#00ff41]",
														border: "border-[#003b00]",
													},
												].map((theme) => {
													const isActive =
														theme.id === "terminal"
															? typeof document !== "undefined" &&
																document.documentElement
																	.getAttribute("data-theme")
																	?.includes("terminal")
															: typeof document !== "undefined" &&
																(theme.id === "dark"
																	? document.documentElement.classList.contains(
																			"dark",
																		)
																	: !document.documentElement.classList.contains(
																			"dark",
																		)) &&
																!document.documentElement.getAttribute(
																	"data-theme",
																);

													return (
														<Button
															key={theme.id}
															variant="ghost"
															className={`relative group h-auto p-0 flex-col items-stretch cursor-pointer overflow-hidden border-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${isActive ? "border-primary ring-2 ring-primary/20" : "border-transparent bg-surface/50 hover:border-border"}`}
															onPress={() => {
																if (theme.id === "terminal") {
																	document.documentElement.setAttribute(
																		"data-theme",
																		"terminal-green-dark",
																	);
																	document.documentElement.classList.add(
																		"dark",
																	);
																} else {
																	document.documentElement.removeAttribute(
																		"data-theme",
																	);
																	document.documentElement.classList.toggle(
																		"dark",
																		theme.id === "dark",
																	);
																}
																localStorage.setItem(
																	"theme",
																	theme.id === "terminal"
																		? "terminal-green-dark"
																		: theme.id,
																);
															}}
														>
															<div
																className={`h-24 ${theme.bg} p-3 flex flex-col gap-2 relative`}
															>
																<div
																	className={`w-full h-2 rounded-sm ${theme.id === "terminal" ? "bg-[#003b00]" : theme.id === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`}
																/>
																<div className="flex gap-2">
																	<div
																		className={`w-3 h-3 rounded-full ${theme.id === "terminal" ? "bg-[#00ff41]" : "bg-primary"}`}
																	/>
																	<div
																		className={`flex-1 h-3 rounded-sm ${theme.id === "terminal" ? "bg-[#002200]" : theme.id === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`}
																	/>
																</div>
																<div
																	className={`w-3/4 h-2 rounded-sm ${theme.id === "terminal" ? "bg-[#003b00]" : theme.id === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`}
																/>
																{isActive && (
																	<div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
																		<Check className="size-3" strokeWidth={3} />
																	</div>
																)}
															</div>
															<div className="px-3 py-2 text-center text-xs font-semibold">
																{theme.name}
															</div>
														</Button>
													);
												})}
											</div>
										</div>

										<Separator className="opacity-50" />

										{/* Accent Color Selection */}
										<div className="space-y-4">
											<h4 className="font-semibold text-sm flex items-center gap-2">
												<Palette className="size-4" /> Accent Colors
											</h4>
											<div className="flex flex-wrap gap-4">
												{[
													{
														name: "Default",
														color: "oklch(62.04% 0.1950 253.83)",
													},
													{
														name: "Emerald",
														color: "oklch(73.29% 0.1941 150.81)",
													},
													{ name: "Rose", color: "oklch(65.32% 0.2335 25.74)" },
													{
														name: "Amber",
														color: "oklch(78.19% 0.1590 72.33)",
													},
													{ name: "Violet", color: "oklch(62.04% 0.1950 300)" },
													{ name: "Cyan", color: "oklch(70% 0.15 200)" },
												].map((accent) => (
													<Tooltip key={accent.name} delay={0}>
														<Tooltip.Trigger>
															<Button
																isIconOnly
																className="size-8 min-w-0 rounded-full border-2 border-transparent hover:border-primary hover:scale-110 transition-all focus:ring-2 ring-primary/30 outline-none"
																style={{ backgroundColor: accent.color }}
																onPress={() => {
																	document.documentElement.style.setProperty(
																		"--accent",
																		accent.color,
																	);
																	toast(`Applied ${accent.name} accent`, {
																		variant: "success",
																	});
																}}
															/>
														</Tooltip.Trigger>
														<Tooltip.Content>{accent.name}</Tooltip.Content>
													</Tooltip>
												))}
											</div>
										</div>

										<Separator className="opacity-50" />

										{/* UI Scaling */}
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<h4 className="font-semibold text-sm flex items-center gap-2">
													<MagicWand className="size-4" /> UI Scaling
												</h4>
												<span className="text-xs bg-surface px-2 py-0.5 rounded border border-border">
													100%
												</span>
											</div>
											<Slider
												defaultValue={100}
												minValue={80}
												maxValue={120}
												step={5}
												aria-label="UI Scaling"
												className="max-w-md"
												onChange={(value: number | number[]) => {
													const scale = (value as number) / 100;
													document.documentElement.style.setProperty(
														"--ui-scale",
														scale.toString(),
													);
													document.documentElement.style.fontSize = `${16 * scale}px`;
												}}
											/>
											<p className="text-[10px] text-muted">
												Adjust the overall size of text and interface elements.
											</p>
										</div>
										<Separator className="opacity-50" />

										{/* Typography */}
										<div className="space-y-4">
											<h4 className="font-semibold text-sm">Typography</h4>
											<Select
												className="max-w-xs"
												defaultSelectedKey="sans"
												onSelectionChange={(key: Key) => {
													const font =
														key === "mono"
															? "var(--font-ibm-plex-mono)"
															: "var(--font-inter)";
													document.documentElement.style.setProperty(
														"--font-sans",
														font,
													);
												}}
											>
												<Label className="text-xs text-muted mb-1 block">
													Font Family
												</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														<ListBox.Item id="sans" textValue="System Sans">
															System Sans
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id="mono" textValue="Terminal Mono">
															Terminal Mono
															<ListBox.ItemIndicator />
														</ListBox.Item>
													</ListBox>
												</Select.Popover>
											</Select>
										</div>

										<Separator className="opacity-50" />

										{/* Visual Effects */}
										<div className="space-y-4">
											<h4 className="font-semibold text-sm">Visual Effects</h4>
											<div className="grid gap-3">
												<Card className="bg-surface/30 border border-border/50 p-4">
													<div className="flex items-center justify-between">
														<div className="space-y-0.5">
															<span className="text-sm font-medium">
																Glassmorphism
															</span>
															<p className="text-xs text-muted">
																Apply frozen glass effects to panels and menus.
															</p>
														</div>
														<Switch defaultSelected>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch>
													</div>
												</Card>
												<Card className="bg-surface/30 border border-border/50 p-4">
													<div className="flex items-center justify-between">
														<div className="space-y-0.5">
															<span className="text-sm font-medium">
																Smooth Transitions
															</span>
															<p className="text-xs text-muted">
																Enable fluid animations across the app.
															</p>
														</div>
														<Switch defaultSelected>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch>
													</div>
												</Card>
											</div>
										</div>
									</Tabs.Panel>

									<Tabs.Panel
										id="security"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">Security</h3>
											<p className="text-muted">Keep your account secure.</p>
										</div>

										<div className="space-y-4">
											<div className="flex items-center justify-between p-4 border border-border rounded-lg">
												<div className="space-y-0.5">
													<span className="font-medium">
														Two-factor Authentication
													</span>
													<p className="text-xs text-muted">
														Add an extra layer of security.
													</p>
												</div>
												<Switch>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
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

									<Tabs.Panel
										id="devices"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">Devices</h3>
											<p className="text-muted">Manage your active devices.</p>
										</div>
										<DevicesPanelContent />
									</Tabs.Panel>

									<Tabs.Panel
										id="notifications"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">Notifications</h3>
											<p className="text-muted text-sm">
												Control exactly when and how you are alerted.
											</p>
										</div>

										{/* Do Not Disturb — master toggle */}
										<Card
											className={`border p-4 transition-colors ${notifSettings.doNotDisturb ? "border-danger/40 bg-danger/5" : "border-border/50 bg-surface/30"}`}
										>
											<div className="flex items-center justify-between gap-4">
												<div className="space-y-0.5">
													<span className="text-sm font-semibold flex items-center gap-2">
														<Bell className="size-4" />
														Do Not Disturb
													</span>
													<p className="text-xs text-muted">
														Silence all notifications until you turn this off.
													</p>
												</div>
												<Switch
													isSelected={notifSettings.doNotDisturb}
													onChange={(checked: boolean) =>
														updateNotif("doNotDisturb", checked)
													}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
										</Card>

										<Separator className="opacity-50" />

										{/* Toast visibility */}
										<div
											className={`space-y-4 transition-opacity ${notifSettings.doNotDisturb ? "opacity-40 pointer-events-none" : ""}`}
										>
											<h4 className="font-semibold text-sm flex items-center gap-2">
												<Bell className="size-4" /> In-App Toasts
											</h4>
											<Card className="bg-surface/30 border border-border/50 p-4">
												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<span className="text-sm font-medium">
															Show popup toasts
														</span>
														<p className="text-xs text-muted">
															Display a banner in the corner for new messages.
														</p>
													</div>
													<Switch
														isSelected={notifSettings.enableToasts}
														onChange={(checked: boolean) =>
															updateNotif("enableToasts", checked)
														}
													>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch>
												</div>
											</Card>
											<Card className="bg-surface/30 border border-border/50 p-4">
												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<span className="text-sm font-medium">Sound</span>
														<p className="text-xs text-muted">
															Play an audio chime when a message arrives.
														</p>
													</div>
													<Switch
														isSelected={notifSettings.enableSound}
														onChange={(checked: boolean) =>
															updateNotif("enableSound", checked)
														}
													>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch>
												</div>
											</Card>
										</div>

										<Separator className="opacity-50" />

										{/* Per-channel toggles */}
										<div
											className={`space-y-4 transition-opacity ${notifSettings.doNotDisturb || !notifSettings.enableToasts ? "opacity-40 pointer-events-none" : ""}`}
										>
											<h4 className="font-semibold text-sm border-b border-border pb-2">
												Message Types
											</h4>
											<div className="flex items-center justify-between py-1">
												<div className="space-y-0.5">
													<Label className="text-sm font-medium">
														Group messages
													</Label>
													<p className="text-xs text-muted">
														Toasts for messages posted in groups you belong to.
													</p>
												</div>
												<Switch
													isSelected={notifSettings.groupMessages}
													onChange={(checked: boolean) =>
														updateNotif("groupMessages", checked)
													}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
											<div className="flex items-center justify-between py-1">
												<div className="space-y-0.5">
													<Label className="text-sm font-medium">
														Direct messages
													</Label>
													<p className="text-xs text-muted">
														Toasts for private one-on-one conversations.
													</p>
												</div>
												<Switch
													isSelected={notifSettings.directMessages}
													onChange={(checked: boolean) =>
														updateNotif("directMessages", checked)
													}
												>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
										</div>

										<Separator className="opacity-50" />

										{/* Mentions-only filter */}
										<div
											className={`space-y-4 transition-opacity ${notifSettings.doNotDisturb || !notifSettings.enableToasts ? "opacity-40 pointer-events-none" : ""}`}
										>
											<h4 className="font-semibold text-sm border-b border-border pb-2">
												Filtering
											</h4>
											<Card className="bg-surface/30 border border-border/50 p-4">
												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<span className="text-sm font-medium">
															Mentions only
														</span>
														<p className="text-xs text-muted">
															Only notify when someone @mentions you in a group.
														</p>
													</div>
													<Switch
														isSelected={notifSettings.mentionsOnly}
														onChange={(checked: boolean) =>
															updateNotif("mentionsOnly", checked)
														}
													>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch>
												</div>
											</Card>
										</div>

										<Separator className="opacity-50" />

										<div className="flex justify-end pt-2">
											<Button
												variant="ghost"
												size="sm"
												className="text-muted hover:text-danger"
												onPress={resetNotif}
											>
												Reset to defaults
											</Button>
										</div>
									</Tabs.Panel>

									<Tabs.Panel
										id="storage"
										className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
									>
										<div>
											<h3 className="text-2xl font-bold mb-1">Storage</h3>
											<p className="text-muted text-sm">
												Manage data usage and local storage.
											</p>
										</div>

										<div className="space-y-6">
											<div className="p-4 border border-border rounded-xl bg-surface/30 flex items-center justify-between">
												<div>
													<h4 className="font-semibold text-sm">Media Cache</h4>
													<p className="text-xs text-muted">
														Currently using 142 MB
													</p>
												</div>
												<Button
													variant="ghost"
													size="sm"
													className="text-danger"
												>
													<TrashBin className="size-4 mr-2" />
													Clear Cache
												</Button>
											</div>

											<div className="space-y-4">
												<h4 className="font-semibold text-sm">Auto-Download</h4>
												<div className="space-y-3">
													<div className="flex items-center justify-between">
														<Label className="text-sm">Photos</Label>
														<Switch defaultSelected>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch>
													</div>
													<div className="flex items-center justify-between">
														<Label className="text-sm">Videos</Label>
														<Switch>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch>
													</div>
													<div className="flex items-center justify-between">
														<Label className="text-sm">Files</Label>
														<Switch>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch>
													</div>
												</div>
											</div>

											<Separator className="opacity-50" />

											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<span className="font-medium">Save to Gallery</span>
													<p className="text-xs text-muted">
														Automatically save incoming photos to system
														gallery.
													</p>
												</div>
												<Switch>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch>
											</div>
										</div>
									</Tabs.Panel>
								</div>
							</Tabs>
							<ExportAccountModal
								isOpen={isExportModalOpen}
								onOpenChange={setIsExportModalOpen}
							/>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
