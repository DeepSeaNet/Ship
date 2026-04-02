"use client";
import { TrashBin } from "@gravity-ui/icons";
import { Button, Card, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import { getUserDevices } from "@/hooks/generated";

export function DevicesPanel() {
	const [devices, setDevices] = useState<
		{ device_id: string; created_at: number }[]
	>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadDevices = async () => {
			try {
				const deps = await getUserDevices();
				setDevices(deps);
			} catch {
				toast("Failed to load devices", { variant: "danger" });
			} finally {
				setLoading(false);
			}
		};
		loadDevices();
	}, []);

	const handleDelete = (id: string) => {
		toast("Device deleted (placeholder)", { variant: "success" });
		setDevices((prev) => prev.filter((d) => d.device_id !== id));
	};

	return (
		<div>
			<h3 className="text-2xl font-bold mb-1">Devices</h3>
			<p className="text-muted mb-6">Manage your active devices.</p>

			{loading ? (
				<div className="text-sm text-muted">Loading devices...</div>
			) : devices.length === 0 ? (
				<div className="text-sm text-muted">No devices found.</div>
			) : (
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
			)}
		</div>
	);
}
