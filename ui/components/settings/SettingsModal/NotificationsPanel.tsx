"use client";
import { Bell } from "@gravity-ui/icons";
import { Button, Card, Label, Separator, Switch } from "@heroui/react";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

export function NotificationsPanel() {
	const {
		settings: notifSettings,
		updateSetting: updateNotif,
		resetSettings: resetNotif,
	} = useNotificationSettings();

	return (
		<div className="space-y-6">
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
						onChange={(checked) => updateNotif("doNotDisturb", checked)}
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
							<span className="text-sm font-medium">Show popup toasts</span>
							<p className="text-xs text-muted">
								Display a banner in the corner for new messages.
							</p>
						</div>
						<Switch
							isSelected={notifSettings.enableToasts}
							onChange={(checked) => updateNotif("enableToasts", checked)}
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
							onChange={(checked) => updateNotif("enableSound", checked)}
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
						<Label className="text-sm font-medium">Group messages</Label>
						<p className="text-xs text-muted">
							Toasts for messages posted in groups you belong to.
						</p>
					</div>
					<Switch
						isSelected={notifSettings.groupMessages}
						onChange={(checked) => updateNotif("groupMessages", checked)}
					>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
					</Switch>
				</div>
				<div className="flex items-center justify-between py-1">
					<div className="space-y-0.5">
						<Label className="text-sm font-medium">Direct messages</Label>
						<p className="text-xs text-muted">
							Toasts for private one-on-one conversations.
						</p>
					</div>
					<Switch
						isSelected={notifSettings.directMessages}
						onChange={(checked) => updateNotif("directMessages", checked)}
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
							<span className="text-sm font-medium">Mentions only</span>
							<p className="text-xs text-muted">
								Only notify when someone @mentions you in a group.
							</p>
						</div>
						<Switch
							isSelected={notifSettings.mentionsOnly}
							onChange={(checked) => updateNotif("mentionsOnly", checked)}
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
		</div>
	);
}
