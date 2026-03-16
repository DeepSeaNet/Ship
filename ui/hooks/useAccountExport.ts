"use client";

import { invoke } from "@tauri-apps/api/core";
import QRCode from "qrcode";
import { useCallback, useState } from "react";

export interface ExportedAccountData {
	cipherText: string;
	keyBase64: string;
	qrCodeUrl: string;
}

export function useAccountExport() {
	const [isExporting, setIsExporting] = useState(false);
	const [exportedData, setExportedData] = useState<ExportedAccountData | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	const exportAccount =
		useCallback(async (): Promise<ExportedAccountData | null> => {
			setIsExporting(true);
			setError(null);

			try {
				// Call Tauri backend to export the account
				const result = await invoke<[string, string]>("export_account");
				const [cipherText, keyBase64] = result;

				// Combine data into JSON for QR code
				const qrData = JSON.stringify({ c: cipherText, k: keyBase64 });

				// Generate QR code with optimized settings
				const qrCodeUrl = await QRCode.toDataURL(qrData, {
					width: 1024,
					margin: 3,
					errorCorrectionLevel: "M",
					color: {
						dark: "#000000",
						light: "#ffffff",
					},
				});

				const data: ExportedAccountData = { cipherText, keyBase64, qrCodeUrl };
				setExportedData(data);
				return data;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to export account";
				setError(message);
				console.error("Account export error:", err);
				return null;
			} finally {
				setIsExporting(false);
			}
		}, []);

	const reset = useCallback(() => {
		setExportedData(null);
		setError(null);
	}, []);

	const downloadQRCode = useCallback(
		(filename?: string) => {
			if (!exportedData?.qrCodeUrl) return;

			const link = document.createElement("a");
			link.download = filename || `account-export-${Date.now()}.png`;
			link.href = exportedData.qrCodeUrl;
			link.click();
		},
		[exportedData],
	);

	const copyToClipboard = useCallback(
		async (text: string): Promise<boolean> => {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch {
				return false;
			}
		},
		[],
	);

	return {
		isExporting,
		exportedData,
		error,
		exportAccount,
		downloadQRCode,
		copyToClipboard,
		reset,
	};
}
