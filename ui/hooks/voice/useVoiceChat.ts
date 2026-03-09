import { useCallback, useEffect, useRef, useState } from "react";
import { useMessengerState } from "../useMessengerState";
import {
	VoiceSessionManager,
	type CallStatus,
	type VoiceSessionState,
} from "./services/VoiceSessionManager";
import type { LogEntry, MediaTrackInfo } from "./types/mediasoup";

export type { CallStatus };

export interface UseVoiceChatReturn extends VoiceSessionState {
	startCall: (sessionId?: string) => Promise<void>;
	endCall: () => void;
	toggleVideo: () => Promise<void>;
	toggleAudio: () => Promise<void>;
	toggleScreenShare: () => Promise<void>;
}

export function useVoiceChat(): UseVoiceChatReturn {
	const { currentUser } = useMessengerState();
	const userId = currentUser?.id;

	const [state, setState] = useState<VoiceSessionState>({
		status: "idle",
		sessionId: null,
		logs: [],
		isVideoEnabled: false,
		isAudioEnabled: false,
		isScreenShareEnabled: false,
		localVideoStream: null,
		localAudioStream: null,
		screenShareStream: null,
		remoteTracks: [],
		participants: {},
	});

	const managerRef = useRef<VoiceSessionManager | null>(null);

	useEffect(() => {
		const manager = new VoiceSessionManager(userId, (newState) => {
			setState(newState);
		});
		managerRef.current = manager;

		return () => {
			manager.cleanup();
			managerRef.current = null;
		};
	}, [userId]);

	const startCall = useCallback(async (sessionId?: string) => {
		await managerRef.current?.startCall(sessionId);
	}, []);

	const endCall = useCallback(async () => {
		await managerRef.current?.endCall();
	}, []);

	const toggleVideo = useCallback(async () => {
		await managerRef.current?.toggleVideo();
	}, []);

	const toggleAudio = useCallback(async () => {
		await managerRef.current?.toggleAudio();
	}, []);

	const toggleScreenShare = useCallback(async () => {
		await managerRef.current?.toggleScreenShare();
	}, []);

	return {
		...state,
		startCall,
		endCall,
		toggleVideo,
		toggleAudio,
		toggleScreenShare,
	};
}
