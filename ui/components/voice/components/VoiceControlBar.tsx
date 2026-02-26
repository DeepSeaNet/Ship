import { Button, Tooltip } from '@heroui/react';
import {
    MdMic, MdMicOff,
    MdVideocam, MdVideocamOff,
    MdScreenShare, MdStopScreenShare,
    MdCallEnd,
    MdInfo,
} from 'react-icons/md';

interface VoiceControlBarProps {
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing?: boolean;
    isInfoOpen: boolean;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare?: () => void;
    onToggleInfo: () => void;
    onHangUp: () => void;
}

interface ControlButtonProps {
    tooltip: string;
    onClick: () => void;
    isActive?: boolean;
    isDanger?: boolean;
    isHangUp?: boolean;
    children: React.ReactNode;
}

function ControlButton({ tooltip, onClick, isActive, isDanger, isHangUp, children }: ControlButtonProps) {
    let className = 'w-14 h-14 rounded-2xl transition-all duration-200 shadow-lg ';

    if (isHangUp) {
        className += 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30';
    } else if (isDanger) {
        className += 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25';
    } else if (isActive) {
        className += 'bg-white text-black hover:bg-white/90';
    } else {
        className += 'bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white border border-white/10';
    }

    return (
        <Tooltip>
            <Button isIconOnly size="lg" className={className} onPress={onClick}>
                {children}
            </Button>
            <Tooltip.Content placement="top">
                {tooltip}
            </Tooltip.Content>
        </Tooltip>
    );
}

export function VoiceControlBar({
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing = false,
    isInfoOpen,
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onToggleInfo,
    onHangUp,
}: VoiceControlBarProps) {
    return (
        <div className="flex items-center justify-center gap-3 py-5 px-6 bg-neutral-950/80 backdrop-blur-md border-t border-white/5">
            {/* Microphone */}
            <ControlButton
                tooltip={isAudioEnabled ? 'Mute' : 'Unmute'}
                onClick={onToggleAudio}
                isActive={isAudioEnabled}
                isDanger={!isAudioEnabled}
            >
                {isAudioEnabled ? <MdMic size={24} /> : <MdMicOff size={24} />}
            </ControlButton>

            {/* Camera */}
            <ControlButton
                tooltip={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                onClick={onToggleVideo}
                isActive={isVideoEnabled}
                isDanger={!isVideoEnabled}
            >
                {isVideoEnabled ? <MdVideocam size={24} /> : <MdVideocamOff size={24} />}
            </ControlButton>

            {/* Screen share */}
            {onToggleScreenShare && (
                <ControlButton
                    tooltip={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    onClick={onToggleScreenShare}
                    isActive={isScreenSharing}
                >
                    {isScreenSharing ? <MdStopScreenShare size={22} /> : <MdScreenShare size={22} />}
                </ControlButton>
            )}

            {/* Spacer separator */}
            <div className="w-px h-8 bg-white/10 mx-1" />

            {/* Info panel toggle */}
            <ControlButton
                tooltip="Call info"
                onClick={onToggleInfo}
                isActive={isInfoOpen}
            >
                <MdInfo size={22} />
            </ControlButton>

            {/* Hang up */}
            <ControlButton tooltip="End call" onClick={onHangUp} isHangUp>
                <MdCallEnd size={24} />
            </ControlButton>
        </div>
    );
}