"use client";
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
	const theme =
		typeof window !== "undefined" ? localStorage.getItem("theme") : "default";
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
