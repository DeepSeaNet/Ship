// ─── Proto types ─────────────────────────────────────────────────────────────

export interface ProtoFingerprint {
	algorithm: string;
	value: string;
}

export interface ProtoDtlsParameters {
	fingerprints?: ProtoFingerprint[];
	role?: string;
}

export interface ProtoIceParameters {
	usernameFragment?: string;
	username_fragment?: string;
	password?: string;
	iceLite?: boolean;
	ice_lite?: boolean;
}

export interface ProtoIceCandidate {
	foundation: string;
	priority: number;
	address: string;
	protocol?: string;
	port: number;
	type?: string;
	tcpType?: string;
}

export interface ProtoTransportOptions {
	id: string;
	iceParameters?: ProtoIceParameters;
	ice_parameters?: ProtoIceParameters;
	iceCandidates?: ProtoIceCandidate[];
	ice_candidates?: ProtoIceCandidate[];
	dtlsParameters?: ProtoDtlsParameters;
	dtls_parameters?: ProtoDtlsParameters;
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

export interface ProtoConsumed {
	consumerId?: string;
	consumer_id?: string;
	producerId?: string;
	producer_id?: string;
	kind?: string;
	rtpParameters?: ProtoRtpParameters;
	rtp_parameters?: ProtoRtpParameters;
}

export interface ProtoProducerAdded {
	producerId?: string;
	producer_id?: string;
	participantId?: string;
	participant_id?: string;
	appData?: string;
	app_data?: string;
}

export interface ProtoProducerRemoved {
	producerId?: string;
	producer_id?: string;
	participantId?: string;
	participant_id?: string;
}

export interface ProtoInitMessage {
	routerRtpCapabilities?: ProtoRtpCapabilities;
	router_rtp_capabilities?: ProtoRtpCapabilities;
	producerTransportOptions?: ProtoTransportOptions;
	producer_transport_options?: ProtoTransportOptions;
	consumerTransportOptions?: ProtoTransportOptions;
	consumer_transport_options?: ProtoTransportOptions;
}

export interface ProtoErrorMessage {
	errorMessage?: string;
	error_message?: string;
}

export interface ProtoVoiceData {
	userId?: string;
	user_id?: string;
	voiceId?: string;
	voice_id?: string;
	data?: Uint8Array;
}

export interface ProtoServerCommit {
	voiceId?: string;
	voice_id?: string;
	commit?: unknown;
	commitId?: string;
	commit_id?: string;
}

export interface ProtoAddProposal {
	voiceId?: string;
	voice_id?: string;
	proposal?: unknown;
}

export interface ProtoServerMessage {
	message?: {
		init?: ProtoInitMessage;
		producerAdded?: ProtoProducerAdded;
		producer_added?: ProtoProducerAdded;
		producerRemoved?: ProtoProducerRemoved;
		producer_removed?: ProtoProducerRemoved;
		consumed?: ProtoConsumed;
		connectedProducerTransport?: object;
		connected_producer_transport?: object;
		connectedConsumerTransport?: object;
		connected_consumer_transport?: object;
		produced?: { producerId?: string; producer_id?: string };
		error?: ProtoErrorMessage;
		voiceData?: ProtoVoiceData;
		voice_data?: ProtoVoiceData;
		serverCommit?: ProtoServerCommit;
		server_commit?: ProtoServerCommit;
		addProposal?: ProtoAddProposal;
		add_proposal?: ProtoAddProposal;
	};
}

export interface VoiceEventPayload {
	type: string;
	data: ProtoServerMessage;
}
