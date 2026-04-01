// ─── Proto types ─────────────────────────────────────────────────────────────

export interface ProtoFingerprint {
	algorithm: string;
	value: string;
}

export interface ProtoCodec {
	mimeType?: string;
	mime_type?: string;
}

export interface ProtoRtpCapabilities {
	codecs?: ProtoCodec[];
}

export interface ProtoRtpParameters {
	mid?: string;
}
