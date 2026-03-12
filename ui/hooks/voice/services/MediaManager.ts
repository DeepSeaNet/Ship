import type { Producer } from "mediasoup-client/types";
import type { LoggerFunction } from "../types/mediasoup";
import type { MediasoupService } from "./MediasoupService";
import {
	type AdvancedMicrophoneController,
	type AdvancedMicrophoneOptions,
	initializeAdvancedMicrophone,
} from "./MicrophoneController";

export interface MediaManagerOptions {
	mediasoupService: MediasoupService;
	addLog: LoggerFunction;
	useAdvancedMicrophoneController?: boolean;
	microphoneOptions?: AdvancedMicrophoneOptions;
}

export class MediaManager {
	private mediasoupService: MediasoupService;
	private localVideoStream: MediaStream | null = null;
	private localAudioStream: MediaStream | null = null;
	private screenShareStream: MediaStream | null = null;
	private screenShareProducerId: string | null = null;
	private videoActive = false;
	private audioActive = false;
	private audioPaused = false;
	private screenShareActive = false;
	private addLog: LoggerFunction;
	private microphoneController: AdvancedMicrophoneController | null = null;
	private microphoneOptions: AdvancedMicrophoneOptions;

	constructor(options: MediaManagerOptions) {
		this.mediasoupService = options.mediasoupService;
		this.addLog = options.addLog;
		this.microphoneOptions = options.microphoneOptions ?? {
			vadThreshold: 0.015,
			vadMinSpeechDuration: 150,
			vadMinSilenceDuration: 300,
			noiseSuppression: true,
			echoCancellation: true,
			autoGainControl: true,
			replaceSilenceWithPackets: true,
		};
	}

	/**
	 * Получить локальный видео поток
	 */
	public getLocalVideoStream(): MediaStream | null {
		return this.localVideoStream;
	}

	/**
	 * Получить локальный аудио поток
	 */
	public getLocalAudioStream(): MediaStream | null {
		return this.localAudioStream;
	}

	/**
	 * Получить поток демонстрации экрана
	 */
	public getScreenShareStream(): MediaStream | null {
		return this.screenShareStream;
	}

	/**
	 * Получить контроллер микрофона
	 */
	public getMicrophoneController(): AdvancedMicrophoneController | null {
		return this.microphoneController;
	}

	/**
	 * Проверка, запущена ли камера
	 */
	public isVideoActive(): boolean {
		//let check if producer appdData sourceType is camera
		const videoProducer = this.mediasoupService.getProducers().get("video");
		if (!videoProducer) return false;
		return videoProducer.appData.sourceType === "camera";
	}

	/**
	 * Проверка, запущен ли микрофон
	 */
	public isAudioActive(): boolean {
		// Проверяем наличие producer'а и активен ли он
		const audioProducer = this.mediasoupService.getProducers().get("audio");
		if (!audioProducer) return false;

		// Если есть контроллер микрофона, проверяем его состояние
		if (this.microphoneController) {
			return this.microphoneController.isActive();
		}

		// В противном случае проверяем просто наличие producer'а
		return !audioProducer.paused;
	}

	/**
	 * Запустить камеру и создать видео producer
	 */
	public async startVideo(): Promise<Producer | null> {
		if (!this.mediasoupService.isInitialized()) {
			this.addLog(
				"Cannot start camera: Mediasoup not initialized",
				"error",
			);
			return null;
		}

		if (this.isVideoActive()) {
			this.addLog("Camera already active", "warning");
			return this.mediasoupService.getProducers().get("video") || null;
		}

		try {
			this.addLog("Starting camera...", "info");
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 360 },
			});

			if (!stream || !stream.getVideoTracks().length) {
				this.addLog(
					"Failed to get video stream or no video tracks",
					"error",
				);
				return null;
			}

			this.addLog(
				`Video stream received: ${stream.id}, tracks: ${stream.getVideoTracks().length}`,
				"success",
			);

			// Создаем отдельный поток только для видео
			const videoTrack = stream.getVideoTracks()[0];
			const videoOnlyStream = new MediaStream([videoTrack]);
			this.localVideoStream = videoOnlyStream;

			this.addLog(
				`Creating Producer for video track ${videoTrack.id}...`,
				"info",
			);
			const videoProducer = await this.mediasoupService.createProducer(
				videoTrack,
				"camera",
			);

			if (!videoProducer) {
				this.addLog("Failed to create video Producer", "error");
				this.stopVideoTracks();
				return null;
			}

			// Логируем информацию о треке и потоке
			this.addLog(
				`Video Producer created: id=${videoProducer.id}, track=${videoTrack.id}, active=${videoTrack.enabled}`,
				"success",
			);
			this.addLog(
				`Local video stream: ${this.localVideoStream.id}, tracks: ${this.localVideoStream.getTracks().length}`,
				"info",
			);

			return videoProducer;
		} catch (error) {
			this.addLog(`Error starting camera: ${error}`, "error");
			this.stopVideoTracks();
			return null;
		}
	}

	/**
	 * Остановить камеру и закрыть видео producer
	 */
	public stopVideo(): void {
		const videoProducer = this.mediasoupService.getProducers().get("video");
		if (videoProducer) {
			this.addLog(`Stopping video Producer ${videoProducer.id}...`, "info");
			videoProducer.close();
			this.mediasoupService.getProducers().delete("video");
		}

		this.stopVideoTracks();
	}

	/**
	 * Остановить видео треки
	 */
	private stopVideoTracks(): void {
		if (this.localVideoStream) {
			this.addLog(
				`Stopping local video stream ${this.localVideoStream.id}`,
				"info",
			);

			// Better to explicitly enumerate tracks to ensure they are closed
			const tracks = this.localVideoStream.getTracks();
			this.addLog(`Stopping ${tracks.length} tracks`, "info");

			tracks.forEach((track) => {
				this.addLog(`Stopping track ${track.id} (kind: ${track.kind})`, "info");
				track.stop();
			});

			this.localVideoStream = null;
		} else {
			this.addLog("Нет активного видеопотока для остановки", "info");
		}
	}

	/**
	 * Создать контроллер микрофона
	 * @param producer аудио producer
	 */
	private async createMicrophoneController(producer: Producer): Promise<void> {
		this.addLog("Initializing microphone controller...", "info");
		try {
			const advancedController = await initializeAdvancedMicrophone(
				producer,
				this.microphoneOptions,
			);
			if (advancedController) {
				this.microphoneController = advancedController;
				this.addLog("Microphone controller initialized successfully", "success");
			}
		} catch (error) {
			this.addLog(`Error initializing microphone controller: ${error}`, "error");
		}
	}

	/**
	 * Запустить микрофон и создать аудио producer
	 */
	public async startAudio(): Promise<Producer | null> {
		if (!this.mediasoupService.isInitialized()) {
			this.addLog(
				"Cannot start microphone: Mediasoup not initialized",
				"error",
			);
			return null;
		}

		if (this.isAudioActive() && this.microphoneController) {
			this.addLog("Microphone already active", "warning");
			return this.mediasoupService.getProducers().get("audio") || null;
		}

		try {
			this.addLog("Starting microphone...", "info");
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			if (!stream || !stream.getAudioTracks().length) {
				this.addLog(
					"Failed to get audio stream or no audio tracks",
					"error",
				);
				return null;
			}

			this.addLog(
				`Audio stream received: ${stream.id}, tracks: ${stream.getAudioTracks().length}`,
				"success",
			);

			// Создаем отдельный поток только для аудио
			const audioTrack = stream.getAudioTracks()[0];
			const audioOnlyStream = new MediaStream([audioTrack]);
			this.localAudioStream = audioOnlyStream;

			this.addLog(
				`Creating Producer for audio track ${audioTrack.id}...`,
				"info",
			);
			const audioProducer = await this.mediasoupService.createProducer(
				audioTrack,
				"microphone",
			);

			if (!audioProducer) {
				this.addLog("Failed to create audio Producer", "error");
				this.stopAudioTracks();
				return null;
			}

			// Создаем контроллер микрофона
			await this.createMicrophoneController(audioProducer);

			// Логируем информацию о треке и потоке
			this.addLog(
				`Audio Producer created: id=${audioProducer.id}, track=${audioTrack.id}, active=${audioTrack.enabled}`,
				"success",
			);
			this.audioActive = true;
			return audioProducer;
		} catch (error) {
			this.addLog(`Error starting microphone: ${error}`, "error");
			this.stopAudioTracks();
			return null;
		}
	}

	/**
	 * Остановить микрофон и закрыть аудио producer
	 */
	public stopAudio(): void {
		// Очищаем контроллер микрофона, если он есть
		if (this.microphoneController) {
			this.addLog("Clearing microphone controller", "info");
			this.microphoneController.cleanup();
			this.microphoneController = null;
		}

		const audioProducer = this.mediasoupService.getProducers().get("audio");
		if (audioProducer) {
			this.addLog(`Stopping audio Producer ${audioProducer.id}...`, "info");
			audioProducer.close();
			this.mediasoupService.getProducers().delete("audio");
		}

		this.stopAudioTracks();
	}

	/**
	 * Приостановить передачу аудио
	 */
	public async pauseAudio(): Promise<void> {
		if (!this.microphoneController) {
			this.addLog("Microphone controller not initialized", "warning");
			return;
		}

		this.addLog("Pausing audio transmission...", "info");
		await this.microphoneController.pause();
	}

	/**
	 * Возобновить передачу аудио
	 */
	public async resumeAudio(): Promise<void> {
		if (!this.microphoneController) {
			this.addLog("Microphone controller not initialized", "warning");
			return;
		}

		this.addLog("Resuming audio transmission...", "info");
		await this.microphoneController.resume();
	}

	/**
	 * Переключить состояние микрофона (вкл/выкл)
	 */
	public async toggleAudio(): Promise<void> {
		if (this.audioPaused && this.audioActive) {
			await this.resumeAudio();
			this.audioPaused = false;
		} else if (!this.audioPaused && this.audioActive) {
			await this.pauseAudio();
			this.audioPaused = true;
		} else {
			await this.startAudio();
		}
	}

	/**
	 * Запустить демонстрацию экрана и создать поток демонстрации экрана
	 */
	public async startScreenShare(): Promise<MediaStream | null> {
		if (!this.mediasoupService.isInitialized()) {
			this.addLog(
				"Cannot start screen share: Mediasoup not initialized",
				"error",
			);
			return null;
		}

		try {
			this.addLog("Starting screen share with audio...", "info");
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					displaySurface: "monitor",
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					frameRate: { ideal: 60 },
				},
				audio: true, // Запрашиваем звук экрана
			});

			if (!stream || !stream.getVideoTracks().length) {
				this.addLog(
					"Failed to get screen share stream or no video tracks",
					"error",
				);
				return null;
			}

			this.addLog(
				`Screen share stream received: ${stream.id}, video tracks: ${stream.getVideoTracks().length}, audio tracks: ${stream.getAudioTracks().length}`,
				"success",
			);

			this.screenShareStream = stream;
			this.screenShareActive = true;

			// Добавляем обработчик для отслеживания остановки демонстрации
			stream.getVideoTracks()[0].onended = () => {
				this.addLog(
					"Screen share video track ended, stopping screen share",
					"info",
				);
				this.stopScreenShare();
			};

			return stream;
		} catch (error) {
			this.addLog(`Error starting screen share: ${error}`, "error");
			this.screenShareActive = false;
			return null;
		}
	}

	/**
	 * Опубликовать демонстрацию экрана
	 */
	public async publishScreenShare(): Promise<void> {
		if (!this.screenShareStream) {
			this.addLog("Screen share stream not initialized", "error");
			return;
		}

		try {
			// Публикуем видеотрек
			const videoTrack = this.screenShareStream.getVideoTracks()[0];
			if (videoTrack) {
				this.addLog("Publishing screen share video...", "info");
				const videoProducerId = await this.mediasoupService.createProducer(
					videoTrack,
					"screen-video",
				);
				this.screenShareProducerId = videoProducerId?.toString() ?? "";
				this.addLog(
					`Screen share video published, producerId: ${videoProducerId}`,
					"success",
				);
			}

			// Публикуем аудиотрек, если он есть
			const audioTracks = this.screenShareStream.getAudioTracks();
			if (audioTracks.length > 0) {
				this.addLog("Publishing screen share audio...", "info");
				const audioProducerId = await this.mediasoupService.createProducer(
					audioTracks[0],
					"screen-audio",
				);
				this.addLog(
					`Screen share audio published, producerId: ${audioProducerId}`,
					"success",
				);
			} else {
				this.addLog("Audio track for screen share not found", "warning");
			}

			this.addLog("Screen share published successfully", "success");
		} catch (error) {
			this.addLog(
				`Error publishing screen share: ${error}`,
				"error",
			);
			this.screenShareActive = false;
			this.stopScreenShare();
			throw error;
		}
	}

	/**
	 * Остановить демонстрацию экрана и закрыть поток демонстрации экрана
	 */
	public stopScreenShare(): void {
		if (this.screenShareStream) {
			this.addLog(
				`Stopping screen share ${this.screenShareStream.id}`,
				"info",
			);

			// Останавливаем все треки
			const tracks = this.screenShareStream.getTracks();
			this.addLog(
				`Stopping ${tracks.length} tracks of screen share`,
				"info",
			);

			tracks.forEach((track) => {
				this.addLog(
					`Stopping track ${track.id} (type: ${track.kind}) of screen share`,
					"info",
				);
				track.stop();
			});

			// Очищаем поток и статус
			this.screenShareStream = null;
			this.screenShareActive = false;
			this.screenShareProducerId = null;

			this.addLog("Screen share stopped", "success");
		} else {
			this.addLog(
				"No active screen share stream to stop",
				"info",
			);
		}
	}

	/**
	 * Установить поток демонстрации экрана
	 */
	public setScreenShareStream(stream: MediaStream): void {
		this.screenShareStream = stream;
	}
	private stopAudioTracks(): void {
		if (this.localAudioStream) {
			this.addLog(
				`Stopping local audio stream ${this.localAudioStream.id}`,
				"info",
			);

			// Better explicitly enumerate tracks to be sure they are closed
			const tracks = this.localAudioStream.getTracks();
			this.addLog(`Stopping ${tracks.length} tracks of local audio stream`, "info");

			tracks.forEach((track) => {
				this.addLog(`Stopping track ${track.id} (type: ${track.kind}) of local audio stream`, "info");
				track.stop();
			});

			this.localAudioStream = null;
		} else {
			this.addLog("No active audio stream to stop", "info");
		}
	}
	/**
	 * Остановить все медиа треки и продюсеры
	 */
	public stopAllMedia(): void {
		this.stopVideo();
		this.stopAudio();
		this.stopScreenShare();
	}
}
