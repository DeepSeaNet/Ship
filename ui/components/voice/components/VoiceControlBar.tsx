import { Button, Tooltip, Card } from '@heroui/react';
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
    let variant: "danger" | "danger-soft" | "secondary" | "tertiary" | "primary" = "tertiary";

    if (isHangUp) {
        variant = "danger";
    } else if (isDanger) {
        variant = "danger-soft";
    } else if (isActive) {
        variant = "primary";
    }

    return (
        <Tooltip>
            <Button
                isIconOnly
                size="lg"
                variant={variant}
                className={`w-12 h-12 rounded-xl shadow-lg transition-all duration-200 ${isHangUp ? 'bg-red-500 hover:bg-red-600' : ''}`}
                onPress={onClick}
            >
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
        <div className="flex items-center justify-center gap-4 py-1 px-4 z-50 shrink-0">
            {/* ── Group 1: Audio & Video ── */}
            <Card className="flex flex-row items-center gap-2 p-1.5 bg-surface backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <ControlButton
                    tooltip={isAudioEnabled ? 'Mute' : 'Unmute'}
                    onClick={onToggleAudio}
                    isActive={isAudioEnabled}
                    isDanger={!isAudioEnabled}
                >
                    {isAudioEnabled ? <MdMic size={28} /> : <MdMicOff size={28} />}
                </ControlButton>

                <ControlButton
                    tooltip={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                    onClick={onToggleVideo}
                    isActive={isVideoEnabled}
                    isDanger={!isVideoEnabled}
                >
                    {isVideoEnabled ? <MdVideocam size={28} /> : <MdVideocamOff size={28} />}
                </ControlButton>
            </Card>

            {/* ── Group 2: Screen & Info ── */}
            <Card className="flex flex-row items-center gap-2 p-1.5 bg-surface backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                {onToggleScreenShare && (
                    <ControlButton
                        tooltip={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                        onClick={onToggleScreenShare}
                        isActive={isScreenSharing}
                    >
                        {isScreenSharing ? <MdStopScreenShare size={26} /> : <MdScreenShare size={26} />}
                    </ControlButton>
                )}
                
                <ControlButton
                    tooltip="Call info"
                    onClick={onToggleInfo}
                    isActive={isInfoOpen}
                >
                    <MdInfo size={26} />
                </ControlButton>
            </Card>

            {/* ── Group 3: Hangup ── */}
            <Card className="p-1.5 bg-transparent shadow-none">
                <ControlButton tooltip="End call" onClick={onHangUp} isHangUp>
                    <MdCallEnd size={28} />
                </ControlButton>
            </Card>
        </div>
    );
}