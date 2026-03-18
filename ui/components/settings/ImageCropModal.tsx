"use client";

import { Button, Modal, Slider } from "@heroui/react";
import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";

interface ImageCropModalProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	imageSrc: string;
	onCropComplete: (croppedImage: Blob) => void;
	aspectRatio?: number;
}

export function ImageCropModal({
	isOpen,
	onOpenChange,
	imageSrc,
	onCropComplete,
	aspectRatio = 1,
}: ImageCropModalProps) {
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

	const onCropChange = (crop: Point) => {
		setCrop(crop);
	};

	const onZoomChange = (zoom: number) => {
		setZoom(zoom);
	};

	const onCropAreaComplete = useCallback((_: Area, relativeAreaPixels: Area) => {
		setCroppedAreaPixels(relativeAreaPixels);
	}, []);

	const createImage = (url: string): Promise<HTMLImageElement> =>
		new Promise((resolve, reject) => {
			const image = new Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", (error) => reject(error));
			image.setAttribute("crossOrigin", "anonymous");
			image.src = url;
		});

	const getCroppedImg = async (
		imageSrc: string,
		pixelCrop: Area,
	): Promise<Blob | null> => {
		const image = await createImage(imageSrc);
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		if (!ctx) return null;

		canvas.width = pixelCrop.width;
		canvas.height = pixelCrop.height;

		ctx.drawImage(
			image,
			pixelCrop.x,
			pixelCrop.y,
			pixelCrop.width,
			pixelCrop.height,
			0,
			0,
			pixelCrop.width,
			pixelCrop.height,
		);

		return new Promise((resolve) => {
			canvas.toBlob((blob) => {
				resolve(blob);
			}, "image/jpeg");
		});
	};

	const handleSave = async () => {
		if (croppedAreaPixels) {
			const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
			if (croppedBlob) {
				onCropComplete(croppedBlob);
				onOpenChange(false);
			}
		}
	};

	return (
		<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Backdrop>
				<Modal.Container>
					<Modal.Dialog className="max-w-xl w-full">
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>Crop Image</Modal.Heading>
						</Modal.Header>
						<Modal.Body className="p-0">
							<div className="relative w-full h-80 bg-neutral-900 border-y border-border overflow-hidden">
								<Cropper
									image={imageSrc}
									crop={crop}
									zoom={zoom}
									aspect={aspectRatio}
									onCropChange={onCropChange}
									onCropComplete={onCropAreaComplete}
									onZoomChange={onZoomChange}
								/>
							</div>
							<div className="p-4 space-y-4">
								<div className="space-y-2">
									<div className="flex justify-between text-xs font-medium text-muted">
										<span>Zoom</span>
										<span>{Math.round(zoom * 100)}%</span>
									</div>
									<Slider
										minValue={1}
										maxValue={3}
										step={0.1}
										value={zoom}
										onChange={(val) => setZoom(val as number)}
										className="w-full"
									>
										<Slider.Track className="bg-surface-secondary">
											<Slider.Fill className="bg-primary" />
											<Slider.Thumb className="border-primary" />
										</Slider.Track>
									</Slider>
								</div>
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button
								variant="ghost"
								onPress={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button variant="primary" onPress={handleSave}>
								Save Changes
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
