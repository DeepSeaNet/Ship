"use client";
import { Check, Display, MagicWand, Palette } from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Card,
	Label,
	ListBox,
	Select,
	Separator,
	Slider,
	Switch,
	Tooltip,
	toast,
} from "@heroui/react";
import { useState } from "react";
import type { AppearanceSettings } from "@/hooks/useAppearanceSettings";

interface AppearancePanelProps {
	settings: AppearanceSettings;
	updateSetting: <K extends keyof AppearanceSettings>(
		key: K,
		value: AppearanceSettings[K],
	) => void;
	resetSettings: () => void;
}

const THEMES = [
	{
		id: "light",
		name: "Light",
		bg: "bg-white",
		text: "text-neutral-900",
		border: "border-neutral-200",
	},
	{
		id: "dark",
		name: "Dark",
		bg: "bg-neutral-900",
		text: "text-white",
		border: "border-neutral-700",
	},
	{
		id: "terminal",
		name: "Terminal",
		bg: "bg-[#0a0f0a]",
		text: "text-[#00ff41]",
		border: "border-[#003b00]",
	},
] as const;

const ACCENTS = [
	{ name: "Default", color: "oklch(62.04% 0.1950 253.83)" },
	{ name: "Emerald", color: "oklch(73.29% 0.1941 150.81)" },
	{ name: "Rose", color: "oklch(65.32% 0.2335 25.74)" },
	{ name: "Amber", color: "oklch(78.19% 0.1590 72.33)" },
	{ name: "Violet", color: "oklch(62.04% 0.1950 300)" },
	{ name: "Cyan", color: "oklch(70% 0.15 200)" },
];

function getActiveTheme() {
	if (typeof document === "undefined") return null;
	const dt = document.documentElement.getAttribute("data-theme");
	if (dt?.includes("terminal")) return "terminal";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(id: (typeof THEMES)[number]["id"]) {
	if (id === "terminal") {
		document.documentElement.setAttribute("data-theme", "terminal-green-dark");
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.removeAttribute("data-theme");
		document.documentElement.classList.toggle("dark", id === "dark");
	}
	localStorage.setItem("theme", id === "terminal" ? "terminal-green-dark" : id);
}

const BUBBLE_RADIUS_OPTIONS: {
	value: AppearanceSettings["bubbleRadius"];
	label: string;
}[] = [
	{ value: "sharp", label: "Sharp" },
	{ value: "rounded", label: "Rounded" },
	{ value: "pill", label: "Pill" },
];

function SwitchRow({
	label,
	description,
	isSelected,
	onChange,
}: {
	label: string;
	description?: string;
	isSelected: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<Card className="bg-surface/30 border border-border/50 p-4">
			<div className="flex items-center justify-between">
				<div className="space-y-0.5">
					<span className="text-sm font-medium">{label}</span>
					{description && <p className="text-xs text-muted">{description}</p>}
				</div>
				<Switch isSelected={isSelected} onChange={onChange}>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
				</Switch>
			</div>
		</Card>
	);
}

/** HeroUI v3 Slider — requires Track/Fill/Thumb children */
function AppSlider({
	label,
	value,
	defaultValue,
	min,
	max,
	step,
	onChange,
}: {
	label: string;
	value?: number;
	defaultValue?: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
}) {
	const props =
		value !== undefined
			? { value, onChange: (v: number | number[]) => onChange(v as number) }
			: {
					defaultValue,
					onChange: (v: number | number[]) => onChange(v as number),
				};

	return (
		<Slider
			{...props}
			minValue={min}
			maxValue={max}
			step={step}
			aria-label={label}
			className="w-full max-w-md"
		>
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	);
}

export function AppearancePanel({
	settings,
	updateSetting,
	resetSettings,
}: AppearancePanelProps) {
	const [activeTheme, setActiveTheme] = useState(getActiveTheme());

	const handleThemeChange = (id: (typeof THEMES)[number]["id"]) => {
		applyTheme(id);
		setActiveTheme(id);
	};

	return (
		<div className="space-y-8">
			{/* Live preview */}
			<div className="bg-surface/30 border border-border/50 rounded-2xl p-6">
				<div className="flex gap-4 items-start">
					<Avatar className="size-10 shrink-0">
						<Avatar.Image src="/avatar.png" />
						<Avatar.Fallback>U</Avatar.Fallback>
					</Avatar>
					<div className="space-y-2 flex-1">
						<div className="flex items-center gap-2">
							<span className="font-bold text-sm">Preview User</span>
							<span className="text-[10px] text-muted">12:34 PM</span>
						</div>
						<Card
							style={{
								borderRadius: "var(--bubble-radius, 18px)",
								fontSize: `${settings.messageFontSize}px`,
							}}
							className="bg-primary text-primary-foreground p-3 max-w-sm shadow-lg shadow-primary/20"
						>
							<p>
								How do you like the new theme? Everything looks so much more
								alive! ✨
							</p>
						</Card>
						<Card
							style={{
								borderRadius: "var(--bubble-radius, 18px)",
								fontSize: `${settings.messageFontSize}px`,
								marginTop: `${settings.messageSpacing}px`,
							}}
							className="bg-primary text-primary-foreground p-3 max-w-sm shadow-lg shadow-primary/20"
						>
							<p>
								Second message — adjust spacing above to see the difference.
							</p>
						</Card>
					</div>
				</div>
			</div>

			<div>
				<h3 className="text-2xl font-bold mb-1">Appearance</h3>
				<p className="text-muted text-sm">
					Customize the interface to match your style.
				</p>
			</div>

			{/* ── Interface Theme ── */}
			<div className="space-y-4">
				<h4 className="font-semibold text-sm flex items-center gap-2">
					<Display className="size-4" /> Interface Theme
				</h4>
				<div className="grid grid-cols-3 gap-4">
					{THEMES.map((theme) => {
						const isActive = activeTheme === theme.id;
						return (
							<Button
								key={theme.id}
								variant="ghost"
								fullWidth
								className={`relative group h-auto p-0 flex-col items-stretch cursor-pointer overflow-hidden border-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${
									isActive
										? "border-primary ring-2 ring-primary/20"
										: "border-transparent bg-surface/50 hover:border-border"
								}`}
								onPress={() => handleThemeChange(theme.id)}
							>
								<div
									className={`h-28 w-full ${theme.bg} p-4 flex flex-col gap-2 relative transition-colors`}
								>
									<div
										className={`w-full h-2 rounded-sm ${theme.id === "terminal" ? "bg-[#003b00]" : theme.id === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`}
									/>
									<div className="flex gap-2">
										<div
											className={`w-4 h-4 rounded-full ${theme.id === "terminal" ? "bg-[#00ff41]" : "bg-primary"}`}
										/>
										<div
											className={`flex-1 h-4 rounded-sm ${theme.id === "terminal" ? "bg-[#002200]" : theme.id === "dark" ? "bg-neutral-700" : "bg-neutral-200"}`}
										/>
									</div>
									<div
										className={`w-3/4 h-2 rounded-sm ${theme.id === "terminal" ? "bg-[#003b00]" : theme.id === "dark" ? "bg-neutral-800" : "bg-neutral-100"}`}
									/>
									{isActive && (
										<div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg animate-in zoom-in duration-200">
											<Check className="size-3.5" />
										</div>
									)}
								</div>
								<div className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wider">
									{theme.name}
								</div>
							</Button>
						);
					})}
				</div>
			</div>

			<Separator className="opacity-50" />

			{/* ── Accent Colors ── */}
			<div className="space-y-4">
				<h4 className="font-semibold text-sm flex items-center gap-2">
					<Palette className="size-4" /> Accent Colors
				</h4>
				<div className="flex flex-wrap gap-4">
					{ACCENTS.map((accent) => (
						<Tooltip key={accent.name} delay={0}>
							<Tooltip.Trigger>
								<Button
									isIconOnly
									className="size-10 min-w-0 rounded-full border-2 border-transparent hover:border-primary hover:scale-110 transition-all focus:ring-2 ring-primary/30 outline-none shadow-md"
									style={{ backgroundColor: accent.color }}
									onPress={() => {
										document.documentElement.style.setProperty(
											"--accent",
											accent.color,
										);
										toast(`Applied ${accent.name} accent`, {
											variant: "success",
										});
									}}
								/>
							</Tooltip.Trigger>
							<Tooltip.Content>{accent.name}</Tooltip.Content>
						</Tooltip>
					))}
				</div>
			</div>

			<Separator className="opacity-50" />

			{/* ── UI Scaling ── */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="font-semibold text-sm flex items-center gap-2">
						<MagicWand className="size-4" /> UI Scaling
					</h4>
					<span className="text-xs bg-surface px-2 py-0.5 rounded border border-border">
						{settings.uiScale}%
					</span>
				</div>
				<AppSlider
					label="UI Scaling"
					value={settings.uiScale}
					min={80}
					max={120}
					step={5}
					onChange={(value) => updateSetting("uiScale", value)}
				/>
				<p className="text-[10px] text-muted">
					Adjust the overall size of text and interface elements.
				</p>
			</div>

			<Separator className="opacity-50" />

			{/* ── Typography ── */}
			<div className="space-y-4">
				<h4 className="font-semibold text-sm">Typography</h4>
				<Select
					className="max-w-xs"
					defaultSelectedKey="sans"
					onSelectionChange={(key) => {
						const font =
							key === "mono"
								? "var(--font-ibm-plex-mono)"
								: "var(--font-inter)";
						document.documentElement.style.setProperty("--font-sans", font);
					}}
				>
					<Label className="text-xs text-muted mb-1 block">Font Family</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							<ListBox.Item id="sans" textValue="System Sans">
								System Sans
								<ListBox.ItemIndicator />
							</ListBox.Item>
							<ListBox.Item id="mono" textValue="Terminal Mono">
								Terminal Mono
								<ListBox.ItemIndicator />
							</ListBox.Item>
						</ListBox>
					</Select.Popover>
				</Select>
			</div>

			<Separator className="opacity-50" />

			{/* ── Chat Layout ── */}
			<div className="space-y-6">
				<h4 className="font-semibold text-sm">Chat Layout</h4>

				{/* Message spacing */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Message Spacing</span>
						<span className="text-xs bg-surface px-2 py-0.5 rounded border border-border">
							{settings.messageSpacing}px
						</span>
					</div>
					<AppSlider
						label="Message spacing"
						value={settings.messageSpacing}
						min={2}
						max={24}
						step={2}
						onChange={(v) => updateSetting("messageSpacing", v)}
					/>
					<p className="text-[10px] text-muted">
						Vertical gap between individual messages.
					</p>
				</div>

				{/* Message font size */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Message Font Size</span>
						<span className="text-xs bg-surface px-2 py-0.5 rounded border border-border">
							{settings.messageFontSize}px
						</span>
					</div>
					<AppSlider
						label="Message font size"
						value={settings.messageFontSize}
						min={11}
						max={20}
						step={1}
						onChange={(v) => updateSetting("messageFontSize", v)}
					/>
					<p className="text-[10px] text-muted">
						Font size inside chat bubbles.
					</p>
				</div>

				{/* Bubble shape */}
				<div className="space-y-3">
					<span className="text-sm font-medium">Bubble Shape</span>
					<div className="flex gap-3">
						{BUBBLE_RADIUS_OPTIONS.map(({ value, label }) => (
							<Button
								key={value}
								variant="ghost"
								fullWidth
								onPress={() => updateSetting("bubbleRadius", value)}
								className={`flex-1 min-w-0 h-10 font-bold rounded-lg border transition-all ${
									settings.bubbleRadius === value
										? "border-primary bg-primary/10 text-primary shadow-sm"
										: "border-border bg-surface/50 hover:border-primary/50"
								}`}
							>
								{label}
							</Button>
						))}
					</div>
					<p className="text-[10px] text-muted">
						Corner style for message bubbles.
					</p>
				</div>

				<SwitchRow
					label="Show Avatars"
					description="Display user avatars next to each message."
					isSelected={settings.showAvatars}
					onChange={(v) => updateSetting("showAvatars", v)}
				/>
				<SwitchRow
					label="Compact Mode"
					description="Reduce padding and element sizes for a denser layout."
					isSelected={settings.compactMode}
					onChange={(v) => updateSetting("compactMode", v)}
				/>
			</div>

			<Separator className="opacity-50" />

			{/* ── Visual Effects ── */}
			<div className="space-y-4">
				<h4 className="font-semibold text-sm">Visual Effects</h4>
				<div className="grid gap-3">
					<Card className="bg-surface/30 border border-border/50 p-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<span className="text-sm font-medium">Glassmorphism</span>
								<p className="text-xs text-muted">
									Apply frozen glass effects to panels and menus.
								</p>
							</div>
							<Switch defaultSelected>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
							</Switch>
						</div>
					</Card>
					<Card className="bg-surface/30 border border-border/50 p-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<span className="text-sm font-medium">Smooth Transitions</span>
								<p className="text-xs text-muted">
									Enable fluid animations across the app.
								</p>
							</div>
							<Switch defaultSelected>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
							</Switch>
						</div>
					</Card>
				</div>
			</div>

			<Separator className="opacity-50" />

			<div className="flex justify-end pt-2">
				<Button
					variant="ghost"
					size="sm"
					className="text-muted hover:text-danger"
					onPress={resetSettings}
				>
					Reset appearance to defaults
				</Button>
			</div>
		</div>
	);
}
