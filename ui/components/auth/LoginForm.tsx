"use client";

import {
	ArrowRight,
	Eye,
	EyeSlash,
	Paperclip,
	QrCode,
} from "@gravity-ui/icons";
import {
	Button,
	Form,
	Input,
	Label,
	Spinner,
	Tabs,
	TextField,
} from "@heroui/react";
import { useState } from "react";

interface LoginFormProps {
	isLoading: boolean;
	onSubmit: (email: string, password: string) => Promise<void>;
	onQrCodeScan: () => void;
	onBase64Import: (base64: string) => Promise<void>;
}

export function LoginForm({
	isLoading,
	onSubmit,
	onQrCodeScan,
	onBase64Import,
}: LoginFormProps) {
	const [showPassword, setShowPassword] = useState(false);
	const [loginEmail, setLoginEmail] = useState("");
	const [loginPassword, setLoginPassword] = useState("");
	const [base64Input, setBase64Input] = useState("");
	const [isBase64Loading, setIsBase64Loading] = useState(false);

	const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		await onSubmit(loginEmail, loginPassword);
	};

	const handleBase64Import = async () => {
		if (!base64Input.trim()) {
			alert("Please enter a valid base64 string");
			return;
		}

		setIsBase64Loading(true);
		try {
			await onBase64Import(base64Input);
		} finally {
			setIsBase64Loading(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
			{/* Login Method Tabs */}
			<Tabs defaultSelectedKey="password">
				<Tabs.ListContainer>
					<Tabs.List aria-label="Login methods">
						<Tabs.Tab id="password">
							<span className="text-sm font-medium">Password</span>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="qr">
							<span className="text-sm font-medium">QR Code</span>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="base64">
							<span className="text-sm font-medium">Base64</span>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>

				{/* Password Tab */}
				<Tabs.Panel id="password" className="animate-in fade-in duration-200">
					<Form className="space-y-4 mt-4" onSubmit={handleLoginSubmit}>
						<TextField
							fullWidth
							isRequired
							name="email"
							type="email"
							value={loginEmail}
							onChange={setLoginEmail}
						>
							<Label>Email Address</Label>
							<Input placeholder="you@example.com" />
						</TextField>

						<TextField
							fullWidth
							isRequired
							name="password"
							type={showPassword ? "text" : "password"}
							value={loginPassword}
							onChange={setLoginPassword}
						>
							<Label>Password</Label>
							<div className="relative">
								<Input placeholder="••••••••" />
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2"
								>
									{showPassword ? (
										<EyeSlash className="w-5 h-5" />
									) : (
										<Eye className="w-5 h-5" />
									)}
								</button>
							</div>
						</TextField>

						<div className="flex items-center justify-between text-sm">
							<label className="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" className="w-4 h-4 rounded" />
								<span>Remember me</span>
							</label>
							<button
								type="button"
								className="text-blue-600 hover:text-blue-700"
							>
								Forgot password?
							</button>
						</div>

						<Button
							fullWidth
							isDisabled={isLoading}
							isPending={isLoading}
							type="submit"
							className="mt-2"
						>
							{isLoading ? (
								<Spinner color="current" size="sm" />
							) : (
								<>
									Sign In <ArrowRight className="w-4 h-4" />
								</>
							)}
						</Button>
					</Form>
				</Tabs.Panel>

				{/* QR Code Tab */}
				<Tabs.Panel id="qr" className="animate-in fade-in duration-200">
					<div className="space-y-4 mt-6">
						<div className="border rounded-lg p-12 flex flex-col items-center justify-center gap-4">
							<div className="text-gray-400">
								<QrCode className="w-16 h-16" />
							</div>
							<p className="text-sm text-gray-600 text-center">
								Use your camera to scan a QR code
							</p>
						</div>

						<Button
							fullWidth
							isDisabled={isLoading}
							isPending={isLoading}
							onPress={onQrCodeScan}
						>
							{isLoading ? (
								<Spinner color="current" size="sm" />
							) : (
								<>
									<QrCode className="w-4 h-4" />
									Scan QR Code
								</>
							)}
						</Button>

						<p className="text-xs text-gray-500 text-center">
							Point your camera at a QR code to sign in instantly
						</p>
					</div>
				</Tabs.Panel>

				{/* Base64 Tab */}
				<Tabs.Panel id="base64" className="animate-in fade-in duration-200">
					<div className="space-y-4 mt-4">
						<TextField
							fullWidth
							isRequired
							name="base64"
							value={base64Input}
							onChange={setBase64Input}
						>
							<Label>Base64 String</Label>
							<Input placeholder="Paste your base64 encoded credentials..." />
						</TextField>

						<p className="text-xs text-gray-500">
							Paste your exported base64 credentials to sign in
						</p>

						<Button
							fullWidth
							isDisabled={isBase64Loading || !base64Input.trim()}
							isPending={isBase64Loading}
							onPress={handleBase64Import}
						>
							{isBase64Loading ? (
								<Spinner color="current" size="sm" />
							) : (
								<>
									<Paperclip className="w-4 h-4" />
									Import & Sign In
								</>
							)}
						</Button>
					</div>
				</Tabs.Panel>
			</Tabs>
		</div>
	);
}
