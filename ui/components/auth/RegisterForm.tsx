"use client";

import { ArrowRight, Eye, EyeSlash } from "@gravity-ui/icons";
import {
	Button,
	Checkbox,
	Form,
	Input,
	Label,
	Spinner,
	TextField,
	toast,
} from "@heroui/react";
import { useEffect, useState } from "react";

interface RegisterFormProps {
	isLoading: boolean;
	onSubmit: (
		username: string,
		password: string,
		confirmPassword: string,
		serverAddress: string,
	) => Promise<void>;
}

export function RegisterForm({ isLoading, onSubmit }: RegisterFormProps) {
	const [registerShowPassword, setRegisterShowPassword] = useState(false);
	const [registerUsername, setRegisterUsername] = useState("");
	const [registerPassword, setRegisterPassword] = useState("");
	const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
	const [registerServerAddress, setRegisterServerAddress] = useState(
		"h3://192.168.101.19:8443",
	);

	useEffect(() => {
		const saved = localStorage.getItem("selectedServerAddress");
		if (saved) setRegisterServerAddress(saved);
	}, []);

	const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (registerPassword !== registerConfirmPassword) {
			toast("Passwords do not match", { variant: "danger" });
			return;
		}
		await onSubmit(
			registerUsername,
			registerPassword,
			registerConfirmPassword,
			registerServerAddress,
		);
	};

	return (
		<Form
			className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
			onSubmit={handleRegisterSubmit}
		>
			<TextField
				fullWidth
				isRequired
				name="username"
				type="text"
				value={registerUsername}
				onChange={setRegisterUsername}
			>
				<Label>Username</Label>
				<Input placeholder="username" />
			</TextField>

			<TextField
				fullWidth
				isRequired
				name="serverAddress"
				type="text"
				value={registerServerAddress}
				onChange={setRegisterServerAddress}
			>
				<Label>Server Address</Label>
				<Input placeholder="h3://192.168.101.19:8443" />
			</TextField>

			<TextField
				fullWidth
				isRequired
				name="password"
				type={registerShowPassword ? "text" : "password"}
				value={registerPassword}
				onChange={setRegisterPassword}
			>
				<Label>Password</Label>
				<div className="relative">
					<Input placeholder="••••••••" />
					<button
						type="button"
						onClick={() => setRegisterShowPassword(!registerShowPassword)}
						className="absolute right-3 top-1/2 -translate-y-1/2"
					>
						{registerShowPassword ? (
							<EyeSlash className="w-5 h-5" />
						) : (
							<Eye className="w-5 h-5" />
						)}
					</button>
				</div>
			</TextField>

			<TextField
				fullWidth
				isRequired
				name="confirmPassword"
				type={registerShowPassword ? "text" : "password"}
				value={registerConfirmPassword}
				onChange={setRegisterConfirmPassword}
			>
				<Label>Confirm Password</Label>
				<div className="relative">
					<Input placeholder="••••••••" />
				</div>
			</TextField>

			<Checkbox id="terms" name="terms">
				<Checkbox.Control>
					<Checkbox.Indicator />
				</Checkbox.Control>
				<Checkbox.Content>
					<Label htmlFor="terms">
						I agree to the Terms of Service and Privacy Policy
					</Label>
				</Checkbox.Content>
			</Checkbox>

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
						Create Account <ArrowRight className="w-4 h-4" />
					</>
				)}
			</Button>
		</Form>
	);
}
