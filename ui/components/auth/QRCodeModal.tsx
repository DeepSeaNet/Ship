"use client";

import { Button, Modal } from "@heroui/react";
import { QrCode } from "@gravity-ui/icons";

interface QRCodeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRCodeModal({ isOpen, onOpenChange }: QRCodeModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Scan QR Code</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="w-full h-64 border rounded-lg flex items-center justify-center">
                <div className="text-center space-y-4">
                  <QrCode className="w-12 h-12 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">
                    Camera access would be initialized here
                  </p>
                  <p className="text-xs text-gray-500">
                    Allow camera permissions to scan QR codes
                  </p>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                onPress={() => onOpenChange(false)}
                variant="secondary"
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
