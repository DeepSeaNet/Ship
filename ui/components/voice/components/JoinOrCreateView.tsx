import { Button, Input, Separator } from "@heroui/react";
import { useState } from "react";
import { MdAdd, MdLogin, MdMic } from "react-icons/md";

interface JoinOrCreateViewProps {
	onCreateCall: () => void;
	onJoinCall: (sessionId: string) => void;
	onCancel: () => void;
}

export function JoinOrCreateView({
	onCreateCall,
	onJoinCall,
	onCancel,
}: JoinOrCreateViewProps) {
	const [sessionId, setSessionId] = useState("");

	const handleJoin = () => {
		const trimmed = sessionId.trim();
		if (trimmed) onJoinCall(trimmed);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleJoin();
	};

	return (
		<div className="flex flex-col items-center justify-center w-full h-full p-10 gap-8">
			{/* Icon */}
			<div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10">
				<MdMic className="text-white text-4xl" />
			</div>

			<div className="text-center">
				<h2 className="text-white text-2xl font-bold tracking-tight mb-2">
					Voice Chat
				</h2>
				<p className="text-neutral-400 text-sm max-w-xs">
					Start a new voice session or join an existing one with a Voice ID.
				</p>
			</div>

			{/* Create button */}
			<Button
				className="w-full max-w-xs h-12 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all"
				onPress={onCreateCall}
			>
				<MdAdd className="text-lg mr-1" />
				Create Voice Chat
			</Button>

			{/* Separator */}
			<div className="flex items-center gap-3 w-full max-w-xs">
				<Separator className="flex-1" />
				<span className="text-neutral-600 text-xs font-medium">OR JOIN</span>
				<Separator className="flex-1" />
			</div>

			{/* Join by ID */}
			<div className="flex flex-col gap-3 w-full max-w-xs">
				<Input
					placeholder="Paste Voice ID (UUID)"
					value={sessionId}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setSessionId(e.target.value)
					}
					onKeyDown={handleKeyDown}
					className="bg-white/5 border border-white/10 rounded-xl text-white"
				/>
				<Button
					className="w-full h-11 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/10"
					onPress={handleJoin}
					isDisabled={!sessionId.trim()}
				>
					<MdLogin className="text-lg mr-1" />
					Join by Voice ID
				</Button>
			</div>

			<button
				onClick={onCancel}
				className="text-neutral-600 hover:text-neutral-400 text-sm transition-colors"
			>
				Cancel
			</button>
		</div>
	);
}
