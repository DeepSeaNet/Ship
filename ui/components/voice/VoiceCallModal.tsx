import { useEffect, useState } from 'react';
import { Modal } from '@heroui/react';
import { useVoiceChat } from '../../hooks/voice/useVoiceChat';
import { useMessengerState } from '../../hooks/useMessengerState';
import { VoiceCallModalProps } from './components/types';

import { JoinOrCreateView } from './components/JoinOrCreateView';
import { ParticipantGrid, RemoteAudioTracks } from './components/ParticipantGrid';
import { VoiceControlBar } from './components/VoiceControlBar';
import { InfoPanel } from './components/InfoPanel';
import { CallStatusBadge } from './components/CallStatusBadge';

export function VoiceCallModal({ isOpen, onClose, chatName, chatAvatar }: VoiceCallModalProps) {
    const { currentUser } = useMessengerState();
    const currentUserId = currentUser?.id || 'unknown';

    const {
        status,
        sessionId,
        startCall,
        endCall,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        isAudioEnabled,
        isVideoEnabled,
        localVideoStream,
        remoteTracks,
        participants
    } = useVoiceChat();
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [showJoinOrCreate, setShowJoinOrCreate] = useState(true);
    // Auto-start when the modal is opened with a chatName target
    useEffect(() => {
        if (isOpen && status === 'idle' && chatName) {
            //startCall();
        }
        if (!isOpen && status !== 'idle' && status !== 'ended') {
            //endCall();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleHangUp = () => {
        endCall();
        onClose();
    };

    const handleCreateCall = () => {
        startCall();
        setShowJoinOrCreate(false);
    }
    const handleJoinCall = (id: string) => {
        startCall(id);
        setShowJoinOrCreate(false);
    }
    // Are we in the pre-call selection screen?
    //const showJoinOrCreate = true;

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={open => !open && handleHangUp()}
        >
            <Modal.Backdrop>
                <Modal.Container>
                    {/*
                     * Full-screen style dialog — we use max-w / max-h to keep it
                     * responsive without any custom CSS classes.
                     */}
                    <Modal.Dialog className="w-screen h-screen max-w-none max-h-none bg-background rounded-none overflow-hidden focus:outline-none flex flex-col">

                        {/* ── Main area ────────────────────────────────────────── */}
                        <div className="flex flex-1 overflow-hidden relative">

                            {/* Participant grid or Join/Create view */}
                            <div className="flex-1 overflow-hidden flex items-stretch">
                                {showJoinOrCreate ? (
                                    <JoinOrCreateView
                                        onCreateCall={handleCreateCall}
                                        onJoinCall={handleJoinCall}
                                        onCancel={handleHangUp}
                                    />
                                ) : (
                                    <ParticipantGrid
                                        localUser={{
                                            id: currentUserId,
                                            name: 'You',
                                            avatar: currentUser?.avatar || chatAvatar,
                                            isMuted: !isAudioEnabled,
                                            isVideoEnabled,
                                            localVideoStream,
                                        }}
                                        remoteTracks={remoteTracks}
                                        participants={participants}
                                    />
                                )}
                            </div>

                            {/* Info side panel (slides in from the right) */}
                            {isInfoOpen && !showJoinOrCreate && (
                                <div className="w-72 shrink-0 overflow-hidden">
                                    <InfoPanel
                                        sessionId={sessionId}
                                        status={status}
                                        localUserId={currentUserId}
                                        remoteTracks={remoteTracks}
                                        participants={participants}
                                        onClose={() => setIsInfoOpen(false)}
                                    />
                                </div>
                            )}

                            {/* Status badge — absolute top-left */}
                            {!showJoinOrCreate && (
                                <div className="absolute top-4 left-4 z-20">
                                    <CallStatusBadge status={status} />
                                </div>
                            )}
                        </div>

                        {/* ── Control bar (Floating-look but positioned below) ── */}
                        {!showJoinOrCreate && (
                            <VoiceControlBar
                                isAudioEnabled={isAudioEnabled}
                                isVideoEnabled={isVideoEnabled}
                                isInfoOpen={isInfoOpen}
                                onToggleAudio={toggleAudio}
                                onToggleVideo={toggleVideo}
                                onToggleScreenShare={toggleScreenShare}
                                onToggleInfo={() => setIsInfoOpen(v => !v)}
                                onHangUp={handleHangUp}
                            />
                        )}

                        {/* Hidden audio tracks — must be in the DOM to play */}
                        <RemoteAudioTracks tracks={remoteTracks} />
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}