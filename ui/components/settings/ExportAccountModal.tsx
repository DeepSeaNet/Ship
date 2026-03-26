"use client";

import {
	ArrowDownToLine,
	Copy,
	ShieldCheck,
	Smartphone,
	Xmark,
} from "@gravity-ui/icons";
import { Button, Modal, Spinner, toast } from "@heroui/react";
import { useEffect } from "react";
import { useAccountExport } from "@/hooks/useAccountExport";
import Image from "next/image";

interface ExportAccountModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

export function ExportAccountModal({
	isOpen,
	onOpenChange,
}: ExportAccountModalProps) {
	const {
		isExporting,
		exportedData,
		error,
		exportAccount,
		downloadQRCode,
		copyToClipboard,
		reset,
	} = useAccountExport();

	// Trigger export when modal opens
	useEffect(() => {
		if (isOpen && !exportedData && !isExporting) {
			exportAccount();
		}
	}, [isOpen, exportedData, isExporting, exportAccount]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			reset();
		}
	}, [isOpen, reset]);

	const handleCopyKey = async () => {
		if (!exportedData) return;
		const success = await copyToClipboard(exportedData.keyBase64);
		if (success) {
			toast("Key copied to clipboard", { variant: "success" });
		} else {
			toast("Failed to copy", { variant: "danger" });
		}
	};

	const handleCopyData = async () => {
		if (!exportedData) return;
		const success = await copyToClipboard(exportedData.cipherText);
		if (success) {
			toast("Encrypted data copied", { variant: "success" });
		} else {
			toast("Failed to copy", { variant: "danger" });
		}
	};

	const handleDownload = () => {
		downloadQRCode();
		toast("QR code downloaded", { variant: "success" });
	};

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Backdrop>
				<Modal.Container>
					<Modal.Dialog className="w-[420px] bg-overlay rounded-3xl overflow-hidden border border-border shadow-2xl">
						<Modal.CloseTrigger className="right-4 top-4" />

						<Modal.Header className="pt-8 px-8 pb-4 border-none">
							<Modal.Heading className="flex items-center gap-3 text-xl font-bold">
								<div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
									<Smartphone className="w-5 h-5 text-accent" />
								</div>
								Add New Device
							</Modal.Heading>
							<p className="text-sm text-muted mt-2">
								Scan this QR code on your new device
							</p>
						</Modal.Header>

						<Modal.Body className="px-8 py-6">
							{isExporting ? (
								<div className="flex flex-col items-center justify-center py-12 gap-4">
									<Spinner size="lg" color="current" />
									<p className="text-sm text-muted font-medium animate-pulse">
										Preparing secure export...
									</p>
								</div>
							) : error ? (
								<div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
									<div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
										<Xmark className="w-8 h-8 text-danger" />
									</div>
									<p className="text-sm text-danger font-medium">{error}</p>
									<Button
										variant="secondary"
										size="sm"
										onPress={() => exportAccount()}
									>
										Try Again
									</Button>
								</div>
							) : exportedData ? (
								<div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
									{/* QR Code */}
									<div className="p-4 bg-white rounded-2xl shadow-lg border border-border/50">
										<Image
											src={exportedData.qrCodeUrl}
											alt="Export QR Code"
											width={224}
											height={224}
										/>
									</div>

									{/* Security Notice */}
									<div className="flex items-start gap-3 p-3 rounded-xl bg-success/5 border border-success/20 w-full">
										<ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
										<div>
											<p className="text-xs font-semibold text-success">
												End-to-End Encrypted
											</p>
											<p className="text-xs text-muted mt-0.5">
												This QR code contains encrypted account data.
											</p>
										</div>
									</div>

									{/* Copy Buttons */}
									<div className="w-full space-y-2">
										<Button
											variant="secondary"
											className="w-full h-10 justify-start gap-3 font-medium"
											onPress={handleCopyKey}
										>
											<Copy className="w-4 h-4" />
											Copy Decryption Key
										</Button>
										<Button
											variant="secondary"
											className="w-full h-10 justify-start gap-3 font-medium"
											onPress={handleCopyData}
										>
											<Copy className="w-4 h-4" />
											Copy Encrypted Data
										</Button>
									</div>
								</div>
							) : null}
						</Modal.Body>

						<Modal.Footer className="px-8 pb-8 pt-2 border-none flex gap-3">
							<Button
								variant="ghost"
								className="flex-1 h-11 font-medium"
								onPress={() => onOpenChange(false)}
							>
								Close
							</Button>
							{exportedData && (
								<Button
									variant="primary"
									className="flex-1 h-11 font-medium gap-2"
									onPress={handleDownload}
								>
									<ArrowDownToLine className="w-4 h-4" />
									Save QR
								</Button>
							)}
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
