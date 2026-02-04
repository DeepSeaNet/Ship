import { Modal, Button, Avatar } from '@heroui/react';
import {
    Microphone,
    Video,
    Display,
    CircleInfo,
    Xmark
} from '@gravity-ui/icons';
import { useVoiceChat } from '../../hooks/voice/useVoiceChat';
import { useEffect, useRef } from 'react';

interface VoiceCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatName?: string;
    chatAvatar?: string;
}

export function VoiceCallModal({ isOpen, onClose, chatName, chatAvatar }: VoiceCallModalProps) {
    const {
        status,
        startCall,
        endCall,
        toggleVideo,
        toggleAudio,
        isVideoEnabled,
        isAudioEnabled,
        localVideoStream,
        remoteTracks
    } = useVoiceChat();

    // Auto-start call when modal opens
    useEffect(() => {
        if (isOpen && status === 'idle') {
            startCall();
        } else if (!isOpen && status !== 'idle' && status !== 'ended') {
            endCall();
        }
    }, [isOpen, status, startCall, endCall]);

    // Video Ref
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Attach local stream
    useEffect(() => {
        if (localVideoRef.current && localVideoStream) {
            localVideoRef.current.srcObject = localVideoStream;
        }
    }, [localVideoStream]);

    const handleClose = () => {
        endCall();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <Modal.Backdrop className="bg-black/80 backdrop-blur-md">
                <Modal.Container>
                    <Modal.Dialog className="max-w-2xl bg-neutral-900 border border-white/10 shadow-2xl rounded-3xl overflow-hidden focus:outline-none">
                        <Modal.Body className="p-0 flex flex-col items-center justify-center min-h-[460px] relative">
                            {/* Status Indicator */}
                            <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                    status === 'calling' ? 'bg-yellow-500 animate-pulse' :
                                        status === 'error' ? 'bg-red-500' : 'bg-neutral-500'
                                    }`} />
                                <span className="text-xs text-neutral-400 capitalize font-medium">{status}</span>
                            </div>

                            {/* Detail Info Button */}
                            <div className="absolute top-6 right-6 z-10">
                                <Button isIconOnly variant="ghost" size="sm" className="text-neutral-500 hover:text-white">
                                    <CircleInfo width={18} />
                                </Button>
                            </div>

                            {/* Main Content Area */}
                            <div className="w-full h-full flex flex-col items-center justify-center p-8">
                                {isVideoEnabled && localVideoStream ? (
                                    <div className="relative w-full h-[320px] bg-black rounded-2xl overflow-hidden border border-white/5 ring-1 ring-white/10 shadow-inner">
                                        <video
                                            ref={localVideoRef}
                                            autoPlay
                                            muted
                                            playsInline
                                            className="w-full h-full object-cover transform scale-x-[-1]"
                                        />
                                        <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] text-white/90 border border-white/10 font-medium">You</div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-6 py-12">
                                        <div className="relative">
                                            {status === 'calling' && (
                                                <div className="absolute -inset-4 rounded-full animate-ping bg-accent/10 duration-1000" />
                                            )}
                                            <div className="relative z-0">
                                                <Avatar className="w-36 h-36">
                                                    <Avatar.Image src={chatAvatar} alt={chatName} />
                                                    <Avatar.Fallback className="text-4xl bg-gradient-to-br from-neutral-700 to-neutral-800 text-white font-bold">
                                                        {chatName?.slice(0, 1).toUpperCase()}
                                                    </Avatar.Fallback>
                                                </Avatar>
                                                {status === 'connected' && (
                                                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-neutral-900 rounded-full" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{chatName || 'Unknown User'}</h2>
                                            <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 inline-block text-sm text-neutral-400">
                                                {status === 'calling' ? 'Calling...' :
                                                    status === 'connected' ? '00:00' : 'Disconnected'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tracks Count Badge */}
                                {remoteTracks.size > 0 && (
                                    <div className="mt-4 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-[10px] text-accent font-bold uppercase tracking-wider">
                                        {remoteTracks.size} Active {remoteTracks.size === 1 ? 'Subscriber' : 'Subscribers'}
                                    </div>
                                )}
                            </div>
                        </Modal.Body>

                        <Modal.Footer className="bg-black/30 backdrop-blur-sm p-8 flex justify-center gap-6 border-t border-white/5">
                            <Button
                                isIconOnly
                                size="lg"
                                variant={isAudioEnabled ? "primary" : "ghost"}
                                className={`${isAudioEnabled ? 'bg-white text-black hover:bg-white/90' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'} rounded-2xl w-14 h-14 transition-all duration-300 shadow-lg`}
                                onPress={toggleAudio}
                            >
                                <Microphone width={24} />
                            </Button>

                            <Button
                                isIconOnly
                                size="lg"
                                variant={isVideoEnabled ? "primary" : "ghost"}
                                className={`${isVideoEnabled ? 'bg-white text-black hover:bg-white/90' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'} rounded-2xl w-14 h-14 transition-all duration-300 shadow-lg`}
                                onPress={toggleVideo}
                            >
                                <Video width={24} />
                            </Button>

                            <Button
                                isIconOnly
                                size="lg"
                                variant="ghost"
                                className="bg-white/5 text-neutral-400 hover:text-white hover:bg-white/20 rounded-2xl w-14 h-14 transition-all"
                            >
                                <Display width={24} />
                            </Button>

                            <Button
                                isIconOnly
                                size="lg"
                                variant="primary"
                                className="bg-red-500 text-white hover:bg-red-600 rounded-2xl w-14 h-14 transition-all duration-300 shadow-lg shadow-red-500/30"
                                onPress={handleClose}
                            >
                                <Xmark width={28} />
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
