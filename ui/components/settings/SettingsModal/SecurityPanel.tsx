"use client";
import { Button, Input, Label, Switch, TextField } from "@heroui/react";

export function SecurityPanel() {
	return (
		<div className="space-y-6">
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
		</div>
	);
}
