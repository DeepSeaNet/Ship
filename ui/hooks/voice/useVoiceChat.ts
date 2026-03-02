import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GrpcSignalingAdapter } from './services/GrpcSignalingAdapter';
import { MediasoupService } from './services/MediasoupService';
import { MediaManager } from './services/MediaManager';
import { WorkerManager } from './services/WorkerManager';
import { LoggerFunction, LogEntry, LogEntryType, MediaTrackInfo } from './types/mediasoup';

export type CallStatus = 'idle' | 'calling' | 'connected' | 'error' | 'ended';

interface UseVoiceChatReturn {
    status: CallStatus;
    sessionId: string | null;
    logs: LogEntry[];
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    isScreenShareEnabled: boolean;
    startCall: (sessionId?: string) => Promise<void>;
    endCall: () => void;
    toggleVideo: () => Promise<void>;
    toggleAudio: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    localVideoStream: MediaStream | null;
    localAudioStream: MediaStream | null;
    screenShareStream: MediaStream | null;
    remoteTracks: MediaTrackInfo[];
}

export function useVoiceChat(): UseVoiceChatReturn {
    const [status, setStatus] = useState<CallStatus>('idle');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);

    // Media State
    const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
    const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
    const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
    const [remoteTracks, setRemoteTracks] = useState<MediaTrackInfo[]>([]);

    const statusRef = useRef<CallStatus>('idle');

    // Sync ref with state
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Services Refs
    const signalingRef = useRef<GrpcSignalingAdapter | null>(null);
    const mediasoupServiceRef = useRef<MediasoupService | null>(null);
    const mediaManagerRef = useRef<MediaManager | null>(null);
    const workerManagerRef = useRef<WorkerManager | null>(null);
    const consumedProducers = useRef<Set<string>>(new Set());
    const startingRef = useRef(false);

    const addLog: LoggerFunction = useCallback(
    (message: string, type: LogEntryType = 'info') => {
        const stack = new Error().stack;
        let callerInfo = 'unknown';

        if (stack) {
        const lines = stack.split('\n');
        // 0 = Error
        // 1 = this function
        // 2 = caller
        if (lines.length >= 3) {
            callerInfo = lines[2].trim();
        }
        }

        const entry: LogEntry = {
        timestamp: new Date(),
        message,
        type,
        };

        setLogs(prev => [...prev, entry]);

        console.log(
        `[VoiceChat] [${type.toUpperCase()}] [${callerInfo}] ${message}`
        );
    },
    []
    );

    const cleanup = useCallback(() => {
        mediaManagerRef.current?.stopAllMedia();
        mediasoupServiceRef.current?.cleanup();
        workerManagerRef.current?.cleanup();
        signalingRef.current?.closeConnection();

        signalingRef.current = null;
        mediasoupServiceRef.current = null;
        mediaManagerRef.current = null;
        workerManagerRef.current = null;

        setStatus('idle');
        setSessionId(null);
        setLocalVideoStream(null);
        setLocalAudioStream(null);
        setScreenShareStream(null);
        setRemoteTracks([]);
        consumedProducers.current.clear();
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setIsScreenShareEnabled(false);
    }, []);
 
    // Auto-cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const handleTrackAdded = useCallback((track: MediaStreamTrack, consumerId: string, producerId: string, participantId?: string, appData?: any) => {
        setRemoteTracks(prev => {
            if (prev.some(t => t.id === track.id)) return prev;
            const trackType = track.kind === 'video' ? 'video' : 'audio';
            const mediaTrackInfo: MediaTrackInfo = {
                id: track.id,
                type: trackType,
                producerId,
                consumerId,
                participantId,
                mediaStreamTrack: track,
                sourceType: appData?.sourceType || 'unknown',
            };
            return [...prev, mediaTrackInfo];
        });
    }, []);

    const handleTrackRemoved = useCallback((trackId: string) => {
        setRemoteTracks(prev => prev.filter(t => t.id !== trackId));
    }, []);

    const startCall = useCallback(async (manualSessionId?: string) => {
        if (status !== 'idle' && status !== 'ended' && status !== 'error') return;
        if (startingRef.current) return;
        startingRef.current = true;

        // Use manual session ID or generate random (UUID v4)
        const newSessionId = manualSessionId || crypto.randomUUID();
        setSessionId(newSessionId);
        setStatus('calling');
        setLogs([]); // Clear previous logs
        try {
            addLog(`Starting call initialization... SessionID: ${newSessionId}`, 'info');
            await invoke('join_session', { sessionId: newSessionId });
            console.log('Joined session')
            // 1. Initialize Signaling
            const signaling = new GrpcSignalingAdapter({
                sessionId: newSessionId,
                addLog,
                onProducerAdded: async (producerId, participantId, appData) => {
                    if (consumedProducers.current.has(producerId)) return;
                    consumedProducers.current.add(producerId);

                    if (mediasoupServiceRef.current?.getDevice()) {
                        addLog(`Запрос потребления producer ${producerId} от участника ${participantId}`, 'info');
                        await signaling.sendMessage({
                            action: 'Consume',
                            producerId: producerId,
                            rtpCapabilities: mediasoupServiceRef.current.getDevice()!.rtpCapabilities,
                        });

                        mediasoupServiceRef.current.setResponseCallback(
                            `consumed:${producerId}`,
                            async (data: any) => {
                                const consumedMessage = data as any;
                                await mediasoupServiceRef.current?.createConsumer(
                                    consumedMessage,
                                    (track, consumerId, newProducerId) => {
                                        handleTrackAdded(track, consumerId, newProducerId, participantId, appData);
                                    },
                                    (m: any) => signaling.sendMessage(m as any)
                                );
                            }
                        );
                    }
                },
                onProducerRemoved: (producerId, participantId) => {
                    // Handle removal logic
                    // Ideally we find the consumer associated with this producer and close it
                    // This mapping needs to be maintained or we iterate consumers
                    mediasoupServiceRef.current?.getConsumers().forEach((consumer: any) => {
                        if (consumer.producerId === producerId) {
                            mediasoupServiceRef.current?.removeConsumer(consumer.id, handleTrackRemoved);
                        }
                    });
                },
                onConnectionStateChange: (connected) => {
                    if (!connected && statusRef.current === 'connected') {
                        addLog('Signaling disconnected', 'warning');
                        // Maybe end call or reconnect?
                    }
                },
                onMessage: async (msg) => {
                    // Always try to handle via mediasoup callbacks first (Produced, Connected, etc)
                    if (mediasoupServiceRef.current?.handleCallback(msg.action, msg as any)) {
                        return;
                    }

                    if (msg.action === 'Init') {
                        const initMsg = msg as any;

                        try {
                            // 1. MUST await this. The device needs to load router capabilities.
                            await mediasoupServiceRef.current?.initializeDevice(initMsg.routerRtpCapabilities);

                            // 2. Only after the promise above resolves can you create transports
                            // It is also safer to wrap this in an async call or ensure createTransports handles it
                            await mediasoupServiceRef.current?.createTransports(
                                initMsg.producerTransportOptions,
                                initMsg.consumerTransportOptions,
                                (m: any) => signaling.sendMessage(m as any)
                            );

                            setStatus('connected');
                            addLog('Call connected & initialized!', 'success');
                        } catch (error: any) {
                            addLog(`Initialization Error: ${error.message}`, 'error');
                            setStatus('error');
                        }
                    } else if (msg.action === 'Produced') {
                        // Confirmation of our produce
                        mediasoupServiceRef.current?.handleCallback('Produced', msg as any);
                    } else if (msg.action === 'ConnectedProducerTransport') {
                        mediasoupServiceRef.current?.handleCallback('ConnectedProducerTransport', msg as any);
                    } else if (msg.action === 'ConnectedConsumerTransport') {
                        mediasoupServiceRef.current?.handleCallback('ConnectedConsumerTransport', msg as any);
                    }
                }
            });
            signalingRef.current = signaling;

            // 2. Initialize Worker Manager
            const workerManager = new WorkerManager({
                sessionId: newSessionId,
                addLog
            });
            workerManager.initializeEncodedStreamWorker();
            workerManagerRef.current = workerManager;

            // 3. Initialize Mediasoup Service
            mediasoupServiceRef.current = new MediasoupService({
                sessionId: newSessionId,
                addLog,
                transformApi: 'encodedStreams',
                workerManager: workerManager
            });

            // 4. Initialize Media Manager
            mediaManagerRef.current = new MediaManager({
                mediasoupService: mediasoupServiceRef.current,
                addLog
            });

            // Connect Signaling
            await signaling.connect();

        } catch (err: any) {
            addLog(`Failed to start call: ${err.message}`, 'error');
            setStatus('error');
        } finally {
            startingRef.current = false;
        }
    }, [status, addLog, handleTrackAdded, handleTrackRemoved]); // dependencies

    const endCall = useCallback(async () => {
        addLog('Ending call...', 'info');
        await invoke('leave_session')
        cleanup();
    }, [addLog, cleanup]);

    const toggleVideo = useCallback(async () => {
        if (!mediaManagerRef.current) return;
        if (isVideoEnabled) {
            mediaManagerRef.current.stopVideo();
            setLocalVideoStream(null);
            setIsVideoEnabled(false);
        } else {
            const producer = await mediaManagerRef.current.startVideo();
            if (producer) {
                setLocalVideoStream(mediaManagerRef.current.getLocalVideoStream());
                setIsVideoEnabled(true);
            }
        }
    }, [isVideoEnabled]);

    const toggleAudio = useCallback(async () => {
        if (!mediaManagerRef.current) return;
        if (isAudioEnabled) {
            mediaManagerRef.current.stopAudio();
            setLocalAudioStream(null);
            setIsAudioEnabled(false);
        } else {
            const producer = await mediaManagerRef.current.startAudio();
            if (producer) {
                setLocalAudioStream(mediaManagerRef.current.getLocalAudioStream());
                setIsAudioEnabled(true);
            }
        }
    }, [isAudioEnabled]);

    const toggleScreenShare = useCallback(async () => {
        if (!mediaManagerRef.current) return;

        if (isScreenShareEnabled) {
            mediaManagerRef.current.stopScreenShare();
            setScreenShareStream(null);
            setIsScreenShareEnabled(false);
            addLog('Screen share stopped', 'info');
        } else {
            try {
                addLog('Requesting screen share...', 'info');
                const stream = await mediaManagerRef.current.startScreenShare();
                if (stream) {
                    await mediaManagerRef.current.publishScreenShare();
                    setScreenShareStream(stream);
                    setIsScreenShareEnabled(true);
                    addLog('Screen share started', 'success');

                    // If user clicks "Stop Sharing" in browser native UI
                    const videoTrack = stream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.onended = () => {
                            setScreenShareStream(null);
                            setIsScreenShareEnabled(false);
                            addLog('Screen share ended', 'info');
                        };
                    }
                }
            } catch (err: any) {
                addLog(`Screen share error: ${err.message || err}`, 'error');
                setIsScreenShareEnabled(false);
                setScreenShareStream(null);
            }
        }
    }, [isScreenShareEnabled, addLog]);

    return {
        status,
        sessionId,
        logs,
        isVideoEnabled,
        isAudioEnabled,
        isScreenShareEnabled,
        startCall,
        endCall,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
        localVideoStream,
        localAudioStream,
        screenShareStream,
        remoteTracks
    };
}
