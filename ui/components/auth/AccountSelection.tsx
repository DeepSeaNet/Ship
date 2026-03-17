"use client";
import { ChevronLeft, LockOpen, Plus } from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Card,
	Description,
	InputOTP,
	Label,
	ListBox,
	Spinner,
} from "@heroui/react";
import { useState } from "react";
import { type Account, loginWithAccount } from "@/hooks";

interface AccountSelectionProps {
	accounts: Account[];
	isLoading: boolean;
	onAddNewAccount: () => void;
	onAccountLogin?: () => void;
}

export function AccountSelection({
	accounts,
	isLoading,
	onAddNewAccount,
	onAccountLogin,
}: AccountSelectionProps) {
	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
		accounts.length > 0 ? accounts[0].user_id.toString() : null,
	);
	const [isLoginLoading, setIsLoginLoading] = useState(false);
	const [loginStage, setLoginStage] = useState<"selection" | "password">(
		"selection",
	);
	const [password, setPassword] = useState("");

	const handleLogin = async () => {
		if (!selectedAccountId) return;
		const account = accounts.find(
			(a) => a.user_id.toString() === selectedAccountId,
		);
		if (!account) return;

		if (account.encrypted && loginStage === "selection") {
			setLoginStage("password");
			setPassword("");
			return;
		}

		setIsLoginLoading(true);
		try {
			await loginWithAccount(account, password);
			// Trigger authentication success
			if (onAccountLogin) {
				onAccountLogin();
			}
		} catch (error) {
			console.error("Login failed:", error);
		} finally {
			setIsLoginLoading(false);
		}
	};

	const getInitials = (username: string) => {
		return username
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	if (isLoading) {
		return (
			<div className="relative z-10 min-h-screen flex items-center justify-center p-4 bg-background">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="relative z-10 min-h-screen flex items-center justify-center p-4 ">
			{loginStage === "selection" ? (
				<div className="w-full max-w-md space-y-4 animate-in slide-in-from-left-8 fade-in duration-300">
					{/* Header */}
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Select Account
						</h1>
						<p className="text-sm text-muted mt-1">
							Choose an account to sign in
						</p>
					</div>

					{/* Accounts ListBox */}
					<Card className="w-full bg-surface border border-border shadow-surface">
						<Card.Content className="p-0">
							<ListBox
								aria-label="Accounts"
								selectionMode="single"
								selectedKeys={
									new Set(selectedAccountId ? [selectedAccountId] : [])
								}
								onSelectionChange={(keys) => {
									const selected = Array.from(keys);
									setSelectedAccountId(selected[0] as string);
								}}
								className="w-full"
							>
								{accounts.map((account) => (
									<ListBox.Item
										key={account.user_id.toString()}
										id={account.user_id.toString()}
										textValue={account.username}
									>
										<div className="flex items-center gap-3 w-full">
											<Avatar
												size="sm"
												className="flex-shrink-0 bg-default text-default-foreground"
											>
												{account.avatar_url && (
													<Avatar.Image
														src={account.avatar_url}
														alt={account.username}
													/>
												)}
												<Avatar.Fallback>
													{getInitials(account.username)}
												</Avatar.Fallback>
											</Avatar>
											<div className="flex flex-col flex-1 min-w-0">
												<Label className="truncate text-foreground">
													{account.username}
												</Label>
												<Description className="truncate text-xs text-muted">
													{account.public_address}@{account.server_address}
												</Description>
											</div>
											<ListBox.ItemIndicator />
										</div>
									</ListBox.Item>
								))}
							</ListBox>
						</Card.Content>
					</Card>

					{/* Login Button */}
					<Button
						fullWidth
						variant="primary"
						isDisabled={!selectedAccountId || isLoginLoading}
						isPending={isLoginLoading}
						onPress={handleLogin}
						className="mt-4"
					>
						{isLoginLoading ? (
							<Spinner color="current" size="sm" />
						) : (
							<>
								<LockOpen className="w-4 h-4" />
								Sign In
							</>
						)}
					</Button>

					{/* Add New Account Card */}
					<button
						onClick={onAddNewAccount}
						className="w-full p-6 border border-border rounded-lg bg-surface hover:bg-on-surface hover:shadow-surface transition-all hover:border-border-hover"
					>
						<div className="flex flex-col items-center justify-center gap-3">
							<div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
								<Plus className="w-5 h-5 text-muted" />
							</div>
							<div className="text-center">
								<p className="font-medium text-sm text-foreground">
									Add Account
								</p>
								<p className="text-xs text-muted">
									Sign in with a different account
								</p>
							</div>
						</div>
					</button>
				</div>
			) : (
				<div className="w-full max-w-md space-y-4 animate-in slide-in-from-right-8 fade-in duration-300">
					{/* Header */}
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Enter Password
						</h1>
						<p className="text-sm text-muted mt-1">
							Unlock{" "}
							<span className="text-foreground font-medium">
								{
									accounts.find(
										(a) => a.user_id.toString() === selectedAccountId,
									)?.username
								}
							</span>
						</p>
					</div>

					{/* Password Input */}
					<Card className="w-full bg-surface border border-border shadow-surface p-6 space-y-6">
						<div className="flex flex-col items-center gap-4">
							<Label htmlFor="password-input">Enter Passcode</Label>
							<InputOTP
								maxLength={6}
								value={password}
								onChange={setPassword}
								variant="secondary"
								autoFocus
								onComplete={() => handleLogin()}
							>
								<InputOTP.Group>
									<InputOTP.Slot index={0} />
									<InputOTP.Slot index={1} />
									<InputOTP.Slot index={2} />
									<InputOTP.Slot index={3} />
									<InputOTP.Slot index={4} />
									<InputOTP.Slot index={5} />
								</InputOTP.Group>
							</InputOTP>
						</div>
					</Card>

					{/* Action Buttons */}
					<div className="flex gap-3 pt-2">
						<Button
							variant="ghost"
							onPress={() => setLoginStage("selection")}
							className="flex-1"
						>
							<ChevronLeft className="w-4 h-4" />
							Back
						</Button>
						<Button
							variant="primary"
							isDisabled={!password || isLoginLoading}
							isPending={isLoginLoading}
							onPress={handleLogin}
							className="flex-1"
						>
							{isLoginLoading ? (
								<Spinner color="current" size="sm" />
							) : (
								<>
									<LockOpen className="w-4 h-4" />
									Sign In
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
