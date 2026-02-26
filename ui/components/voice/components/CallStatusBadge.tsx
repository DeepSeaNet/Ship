interface CallStatusBadgeProps {
    status: string;
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
    connected: {
        dot: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]',
        label: 'Connected',
    },
    calling: {
        dot: 'bg-yellow-400 animate-pulse',
        label: 'Calling…',
    },
    error: {
        dot: 'bg-red-500',
        label: 'Error',
    },
    idle: {
        dot: 'bg-neutral-500',
        label: 'Idle',
    },
};

export function CallStatusBadge({ status }: CallStatusBadgeProps) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.idle;
    return (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
            <span className="text-xs text-neutral-300 font-medium capitalize">{style.label}</span>
        </div>
    );
}