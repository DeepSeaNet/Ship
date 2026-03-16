"use client";
import { useState, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toast } from "@heroui/react";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const [theme, setTheme] = useState("default");

	useEffect(() => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme) {
			setTheme(savedTheme);
			// Apply 'dark' class if the theme is dark or terminal-green-dark
			if (savedTheme === "dark" || savedTheme === "terminal-green-dark") {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}

		// Optional: Listen for storage events to update theme across tabs/windows
		const handleStorage = (e: StorageEvent) => {
			if (e.key === "theme" && e.newValue) {
				setTheme(e.newValue);
				if (e.newValue === "dark" || e.newValue === "terminal-green-dark") {
					document.documentElement.classList.add("dark");
				} else {
					document.documentElement.classList.remove("dark");
				}
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	return (
		<html lang="en" data-theme={theme}>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<div>
					<Toast.Provider />
					{children}
				</div>
			</body>
		</html>
	);
}
