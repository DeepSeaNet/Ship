// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { types as mediasoupTypes } from "mediasoup-client";

export const minimalCapabilities: mediasoupTypes.RtpCapabilities = {
	codecs: [
		// ===== AUDIO =====
		{
			kind: "audio",
			mimeType: "audio/opus",
			clockRate: 48000,
			channels: 2,
			preferredPayloadType: 111,
			parameters: {
				useinbandfec: 1,
				stereo: 1,
				maxplaybackrate: 48000,
				ptime: 20,
			},
			rtcpFeedback: [
				{ type: "transport-cc" },
				{ type: "ccm", parameter: "fir" },
				{ type: "nack" },
				{ type: "nack", parameter: "pli" },
			],
		},

		// ===== VIDEO VP8 =====
		{
			kind: "video",
			mimeType: "video/VP8",
			clockRate: 90000,
			preferredPayloadType: 96,
			parameters: {},
			rtcpFeedback: [
				{ type: "nack" },
				{ type: "nack", parameter: "pli" },
				{ type: "ccm", parameter: "fir" },
				{ type: "goog-remb" },
				{ type: "transport-cc" },
			],
		},
		// RTX для VP8
		{
			kind: "video",
			mimeType: "video/rtx",
			preferredPayloadType: 97,
			clockRate: 90000,
			parameters: { apt: 96 },
			rtcpFeedback: [],
		},

		// ===== VIDEO VP9 =====
		{
			kind: "video",
			mimeType: "video/VP9",
			clockRate: 90000,
			preferredPayloadType: 98,
			parameters: { "profile-id": 2 },
			rtcpFeedback: [
				{ type: "nack" },
				{ type: "nack", parameter: "pli" },
				{ type: "ccm", parameter: "fir" },
				{ type: "goog-remb" },
				{ type: "transport-cc" },
			],
		},
		// RTX для VP9
		{
			kind: "video",
			mimeType: "video/rtx",
			preferredPayloadType: 99,
			clockRate: 90000,
			parameters: { apt: 98 },
			rtcpFeedback: [],
		},

		// ===== VIDEO H264 =====
		{
			kind: "video",
			mimeType: "video/H264",
			clockRate: 90000,
			preferredPayloadType: 100,
			parameters: {
				"level-asymmetry-allowed": 1,
				"packetization-mode": 1,
				"profile-level-id": "42e01f",
			},
			rtcpFeedback: [
				{ type: "nack" },
				{ type: "nack", parameter: "pli" },
				{ type: "ccm", parameter: "fir" },
				{ type: "goog-remb" },
				{ type: "transport-cc" },
			],
		},
		// RTX для H264
		{
			kind: "video",
			mimeType: "video/rtx",
			preferredPayloadType: 101,
			clockRate: 90000,
			parameters: { apt: 100 },
			rtcpFeedback: [],
		},
	],

	headerExtensions: [
		// ===== AUDIO =====
		{
			kind: "audio",
			uri: "urn:ietf:params:rtp-hdrext:sdes:mid",
			preferredId: 1,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "audio",
			uri: "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
			preferredId: 4,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "audio",
			uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
			preferredId: 5,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "audio",
			uri: "urn:ietf:params:rtp-hdrext:ssrc-audio-level",
			preferredId: 10,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "audio",
			uri: "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
			preferredId: 11,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "audio",
			uri: "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id",
			preferredId: 12,
			preferredEncrypt: false,
			direction: "sendrecv",
		},

		// ===== VIDEO =====
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:sdes:mid",
			preferredId: 1,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
			preferredId: 4,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
			preferredId: 5,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:toffset",
			preferredId: 13,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
			preferredId: 14,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id",
			preferredId: 15,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:framemarking",
			preferredId: 16,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:3gpp:video-orientation",
			preferredId: 17,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "urn:ietf:params:rtp-hdrext:playout-delay",
			preferredId: 18,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "http://www.webrtc.org/experiments/rtp-hdrext/video-content-type",
			preferredId: 19,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
		{
			kind: "video",
			uri: "http://www.webrtc.org/experiments/rtp-hdrext/video-timing",
			preferredId: 20,
			preferredEncrypt: false,
			direction: "sendrecv",
		},
	],
};
