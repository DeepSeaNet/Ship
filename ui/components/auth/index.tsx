"use client";

import { Alert, Button, Card } from "@heroui/react";
import { useEffect, useState } from "react";
import { LandscapeBackground } from "@/components/landscape";
import { MainMenu } from "@/components/messenger";
import { useAccountList } from "@/hooks";
import { AccountSelection } from "./AccountSelection";
import { LoginForm } from "./LoginForm";
import { QRCodeModal } from "./QRCodeModal";
import { RegisterForm } from "./RegisterForm";
import { importAccount, register } from "@/hooks/generated";

type AuthMode = "login" | "register";

export default function AuthPage() {
	const [authMode, setAuthMode] = useState<AuthMode>("login");
	const [isLoading, setIsLoading] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [showAccountSelection, setShowAccountSelection] = useState(false);
	const [skipAccountSelection, setSkipAccountSelection] = useState(false);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	// Load accounts
	const { accounts, loadingAccounts, refreshAccounts } = useAccountList();

	// Show account selection if accounts exist and we just loaded
	useEffect(() => {
		if (!loadingAccounts && accounts.length > 0 && !skipAccountSelection) {
			setShowAccountSelection(true);
		}
	}, [loadingAccounts, accounts, skipAccountSelection]);

	const handleAddNewAccount = () => {
		setShowAccountSelection(false);
		setSkipAccountSelection(true);
	};

	const handleBackToAccounts = () => {
		setShowAccountSelection(true);
		setSkipAccountSelection(false);
	};

	const handleLoginSubmit = async (_email: string, _password: string) => {
		setIsLoading(true);
		try {
			setSuccessMessage("Login successful! Redirecting...");
			setTimeout(() => {
				setSuccessMessage("");
				setIsAuthenticated(true);
			}, 1000);
		} catch (error) {
			console.error("Login failed:", error);
			// setErrorMessage would be nice but using alert for now as per current pattern
			alert(`Login failed: ${error}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleRegisterSubmit = async (
		username: string,
		password: string,
		confirmPassword: string,
	) => {
		setIsLoading(true);
		try {
			if (password !== confirmPassword) {
				throw new Error("Passwords do not match");
			}
			try {
				await register({ username });
			} catch (error) {
				console.error("Registration failed:", error);
				alert(`Registration failed: ${error}`);
			}

			setSuccessMessage(
				"Account created successfully! Updating account list...",
			);

			// Refresh accounts so the new one appears
			await refreshAccounts();

			setTimeout(() => {
				setSuccessMessage("");
				setShowAccountSelection(true);
				setSkipAccountSelection(false);
				setAuthMode("login");
			}, 2000);
		} catch (error) {
			console.error("Registration failed:", error);
			alert(`Registration failed: ${error}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleQRCodeScan = () => {
		setQrModalOpen(true);
	};

	const handleBase64Import = async (data: string, key: string) => {
		setIsLoading(true);
		try {
			const userId = await importAccount({ exportedAccount: data, key });

			setSuccessMessage(`Account imported successfully (ID: ${userId})!`);
			setTimeout(() => {
				setSuccessMessage("");
				// Refresh account list if needed, or redirect
				window.location.reload();
			}, 2000);
		} catch (error) {
			console.error("Import failed:", error);
			alert(`Import failed: ${error}`);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			{isAuthenticated ? (
				<MainMenu />
			) : (
				<>
					{/* Animated Landscape Background */}
					<LandscapeBackground
						zoomMode={!showAccountSelection ? authMode : "default"}
					/>

					{/* Show account selection if accounts exist */}
					{showAccountSelection && accounts.length > 0 ? (
						<AccountSelection
							accounts={accounts}
							isLoading={loadingAccounts}
							onAddNewAccount={handleAddNewAccount}
							onAccountLogin={() => setIsAuthenticated(true)}
						/>
					) : (
						/* Auth form (Login/Register) */
						<div className="relative z-10 min-h-screen flex items-center justify-center p-4">
							{/* Main container */}
							<div className="w-full max-w-md">
								{/* Success Alert */}
								{successMessage && (
									<Alert
										status="success"
										className="mb-4 animate-in fade-in slide-in-from-top-4 duration-300"
									>
										<Alert.Indicator />
										<Alert.Content>
											<Alert.Title>Success!</Alert.Title>
											<Alert.Description>{successMessage}</Alert.Description>
										</Alert.Content>
									</Alert>
								)}

								{/* Auth Card */}
								<Card className="w-full">
									{/* Header */}
									<Card.Header className="flex flex-col gap-2 relative">
										{accounts.length > 0 && (
											<Button
												type="button"
												variant="ghost"
												onPress={handleBackToAccounts}
												className="absolute left-0 top-4 text-blue-600 hover:text-blue-700 text-sm font-medium border-none shadow-none"
											>
												← Back to Accounts
											</Button>
										)}
										<Card.Title>
											{authMode === "login" ? "Welcome Back" : "Create Account"}
										</Card.Title>
										<Card.Description>
											{authMode === "login"
												? "Sign in to your account to continue"
												: "Join us today and get started"}
										</Card.Description>
									</Card.Header>

									{/* Content */}
									<Card.Content className="pt-6">
										{authMode === "login" ? (
											<LoginForm
												isLoading={isLoading}
												onSubmit={handleLoginSubmit}
												onQrCodeScan={handleQRCodeScan}
												onBase64Import={handleBase64Import}
											/>
										) : (
											<RegisterForm
												isLoading={isLoading}
												onSubmit={handleRegisterSubmit}
											/>
										)}
									</Card.Content>

									{/* Footer */}
									<Card.Footer className="flex flex-col gap-3">
										{authMode === "login" ? (
											<p className="text-sm text-center">
												Dont have an account?{" "}
												<Button
													type="button"
													onPress={() => setAuthMode("register")}
													className="text-blue-600 hover:text-blue-700 font-semibold h-auto p-0 border-none shadow-none bg-transparent min-w-0"
													variant="ghost"
												>
													Sign up here
												</Button>
											</p>
										) : (
											<p className="text-sm text-center">
												Already have an account?{" "}
												<Button
													type="button"
													onPress={() => setAuthMode("login")}
													className="text-blue-600 hover:text-blue-700 font-semibold h-auto p-0 border-none shadow-none bg-transparent min-w-0"
													variant="ghost"
												>
													Sign in here
												</Button>
											</p>
										)}

										<div className="flex items-center gap-2 text-xs">
											<div className="flex-1 h-px bg-gray-300" />
											<span>OR</span>
											<div className="flex-1 h-px bg-gray-300" />
										</div>

										<div className="flex gap-2">
											<Button fullWidth variant="secondary">
												Sign in with Google
											</Button>
											<Button fullWidth variant="secondary">
												Sign in with GitHub
											</Button>
										</div>
									</Card.Footer>
								</Card>
							</div>

							{/* QR Code Modal */}
							<QRCodeModal isOpen={qrModalOpen} onOpenChange={setQrModalOpen} />
						</div>
					)}
				</>
			)}
		</>
	);
}
