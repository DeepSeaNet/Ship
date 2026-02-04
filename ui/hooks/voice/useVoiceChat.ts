import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GrpcSignalingAdapter } from './services/GrpcSignalingAdapter';
import { MediasoupService } from './services/MediasoupService';
import { MediaManager } from './services/MediaManager';
import { LoggerFunction, LogEntry, LogEntryType } from './types/mediasoup';

export type CallStatus = 'idle' | 'calling' | 'connected' | 'error' | 'ended';

interface UseVoiceChatReturn {
    status: CallStatus;
    sessionId: string | null;
    logs: LogEntry[];
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    isScreenShareEnabled: boolean;
    startCall: () => Promise<void>;
    endCall: () => void;
    toggleVideo: () => Promise<void>;
    toggleAudio: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    localVideoStream: MediaStream | null;
    localAudioStream: MediaStream | null;
    screenShareStream: MediaStream | null;
    remoteTracks: Map<string, MediaStreamTrack>;
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
    const [remoteTracks, setRemoteTracks] = useState<Map<string, MediaStreamTrack>>(new Map());

    const statusRef = useRef<CallStatus>('idle');

    // Sync ref with state
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Services Refs
    const signalingRef = useRef<GrpcSignalingAdapter | null>(null);
    const mediasoupServiceRef = useRef<MediasoupService | null>(null);
    const mediaManagerRef = useRef<MediaManager | null>(null);

    const addLog: LoggerFunction = useCallback((message: string, type: LogEntryType = 'info') => {
        const entry: LogEntry = {
            timestamp: new Date(),
            message,
            type
        };
        setLogs(prev => [...prev, entry]);
        console.log(`[VoiceChat] [${type.toUpperCase()}] ${message}`);
    }, []);

    const cleanup = useCallback(() => {
        mediaManagerRef.current?.stopAllMedia();
        mediasoupServiceRef.current?.cleanup();
        signalingRef.current?.closeConnection();

        signalingRef.current = null;
        mediasoupServiceRef.current = null;
        mediaManagerRef.current = null;

        setStatus('idle');
        setSessionId(null);
        setLocalVideoStream(null);
        setLocalAudioStream(null);
        setScreenShareStream(null);
        setRemoteTracks(new Map());
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setIsScreenShareEnabled(false);
    }, []);

    const handleTrackAdded = useCallback((track: MediaStreamTrack, consumerId: string, producerId: string) => {
        setRemoteTracks(prev => {
            const newMap = new Map(prev);
            newMap.set(consumerId, track);
            return newMap;
        });
    }, []);

    const handleTrackRemoved = useCallback((trackId: string) => {
        setRemoteTracks(prev => {
            const newMap = new Map();
            // remoteTracks keys are consumerIds, not trackIds usually, but let's check values
            // Actually MediasoupService calls onTrackRemoved with trackId if available? 
            // Let's rely on MediasoupService ConsumerId usually.
            // The service passes track ID? Let's check service code in a moment.
            // Assuming specific logic:
            for (const [key, value] of prev.entries()) {
                if (value.id !== trackId) {
                    newMap.set(key, value);
                }
            }
            return newMap;
        });
    }, []);

    const startCall = useCallback(async () => {
        if (status !== 'idle' && status !== 'ended' && status !== 'error') return;

        // Generate random session ID (UUID v4)
        const newSessionId = crypto.randomUUID();
        setSessionId(newSessionId);
        setStatus('calling');
        setLogs([]); // Clear previous logs

        try {
            addLog(`Starting call initialization... SessionID: ${newSessionId}`, 'info');
            invoke('join_session', { sessionId: newSessionId });
            // 1. Initialize Signaling
            const signaling = new GrpcSignalingAdapter({
                sessionId: newSessionId,
                addLog,
                onProducerAdded: async (producerId, participantId, appData) => {
                    // Signal received that a producer was added
                    // Need to consume it
                    // Typically we handle this by asking MediasoupService to create consumer
                    // We need to implement consume logic here involving signaling 
                    // But for this simplified demo, we assume Mediasoup flow:
                    // 1. Server notifies Client A about Client B's producer
                    // 2. Client A sends "Consume" request via signaling
                    // 3. Server replies with consumer parameters
                    // 4. Client A calls recvTransport.consume()

                    // NOTE: The current Service/Manager structure assumes some automations or we need to wire it manually.
                    // Referencing `GrpcSignalingAdapter` logic... it just calls callback.
                    // We'll need to call `mediasoupService.createConsumer` when appropriate.
                    // But `createConsumer` needs `ServerConsumed` message which comes from server response to "Consume".

                    // So: Send "Consume" message to server
                    await signaling.sendMessage({
                        action: 'Consume',
                        producerId,
                    });
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
                    } else if (msg.action === 'Consumed') {
                        // Response to our Consume request
                        const consumedMsg = msg as any;
                        await mediasoupServiceRef.current?.createConsumer(
                            consumedMsg,
                            handleTrackAdded,
                            (m: any) => signaling.sendMessage(m as any)
                        );
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

            // 2. Initialize Mediasoup Service (Wait for Init message to fully init device)
            mediasoupServiceRef.current = new MediasoupService({
                sessionId: newSessionId,
                addLog,
                transformApi: 'encodedStreams', // or 'script'/'encodedStreams' if supported
            });

            // 3. Initialize Media Manager
            mediaManagerRef.current = new MediaManager({
                mediasoupService: mediasoupServiceRef.current,
                addLog
            });

            // Connect Signaling
            await signaling.connect();

        } catch (err: any) {
            addLog(`Failed to start call: ${err.message}`, 'error');
            setStatus('error');
        }
    }, [status, addLog, handleTrackAdded, handleTrackRemoved]); // dependencies

    const endCall = useCallback(() => {
        addLog('Ending call...', 'info');
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
        // Placeholder for future impl
        addLog('Screen share toggled (logic pending)', 'info');
    }, [addLog]);

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
