"use client";
import { Button, Label, Separator, Switch } from "@heroui/react";
import { TrashBin } from "@gravity-ui/icons";

export function StoragePanel() {
	return (
		<div className="space-y-6">
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
						{(["Photos", "Videos", "Files"] as const).map((item, i) => (
							<div key={item} className="flex items-center justify-between">
								<Label className="text-sm">{item}</Label>
								<Switch defaultSelected={i === 0}>
									<Switch.Control>
										<Switch.Thumb />
									</Switch.Control>
								</Switch>
							</div>
						))}
					</div>
				</div>

				<Separator className="opacity-50" />

				<div className="flex items-center justify-between">
					<div className="space-y-0.5">
						<span className="font-medium">Save to Gallery</span>
						<p className="text-xs text-muted">
							Automatically save incoming photos to system gallery.
						</p>
					</div>
					<Switch>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
					</Switch>
				</div>
			</div>
		</div>
	);
}
