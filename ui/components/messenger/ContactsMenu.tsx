import { Plus, ShieldCheck, Xmark } from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Input,
	Modal,
	ScrollShadow,
	Slider,
} from "@heroui/react";
import { useState } from "react";
import { useMessengerState } from "@/hooks";

interface ContactsMenuProps {
	onClose: () => void;
}

export function ContactsMenu({ onClose }: ContactsMenuProps) {
	const {
		contacts,
		contactsLoading,
		contactsError,
		addContact,
		manageTrustFactor,
	} = useMessengerState();
	const [newUserId, setNewUserId] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [addError, setAddError] = useState("");
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);

	// Trust Factor Modal State
	const [trustModalOpen, setTrustModalOpen] = useState(false);
	const [selectedContactId, setSelectedContactId] = useState<string | null>(
		null,
	);
	const [trustLevel, setTrustLevel] = useState(50);

	const contactsList = Object.values(contacts);

	const handleAddContact = async () => {
		if (!newUserId.trim()) return;
		setIsAdding(true);
		setAddError("");
		try {
			await addContact(newUserId);
			setNewUserId("");
			setIsAddModalOpen(false);
		} catch (err) {
			setAddError(`Failed to add contact. ID might be invalid. ${err}`);
		} finally {
			setIsAdding(false);
		}
	};

	const openTrustModal = (id: string) => {
		setSelectedContactId(id);
		setTrustLevel(50); // Default or could read from contact info if stored
		setTrustModalOpen(true);
	};

	const handleSaveTrustFactor = async () => {
		if (selectedContactId) {
			await manageTrustFactor(selectedContactId, trustLevel);
			setTrustModalOpen(false);
			setSelectedContactId(null);
		}
	};

	return (
		<div className="w-full h-full bg-surface flex flex-col gap-4 p-4">
			{/* Header */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-bold text-accent-surface">Contacts</h2>
					<div className="flex gap-1">
						<Button
							isIconOnly
							variant="ghost"
							size="sm"
							onPress={() => setIsAddModalOpen(true)}
							className="hover:bg-on-surface text-muted"
						>
							<Plus className="w-5 h-5" />
						</Button>
						<Button
							isIconOnly
							variant="ghost"
							size="sm"
							onPress={onClose}
							className="hover:bg-on-surface text-muted"
						>
							<Xmark className="w-5 h-5" />
						</Button>
					</div>
				</div>
			</div>

			{/* Contacts List */}
			<ScrollShadow className="flex-1 overflow-y-auto -mx-4 px-4">
				{contactsLoading && contactsList.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-sm text-muted">Loading contacts...</div>
					</div>
				) : contactsError ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-sm text-danger">{contactsError}</div>
					</div>
				) : contactsList.length === 0 ? (
					<div className="flex items-center justify-center h-full text-center p-4">
						<p className="text-sm text-muted">No contacts found.</p>
					</div>
				) : (
					<div className="space-y-1">
						{contactsList.map((c) => (
							<div
								key={c.id}
								className="flex items-center gap-3 p-2 rounded-xl hover:bg-on-surface transition group"
							>
								<Avatar size="md" className="shrink-0">
									{c.avatar && <Avatar.Image src={c.avatar} alt={c.name} />}
									<Avatar.Fallback>
										{c.name ? c.name.charAt(0).toUpperCase() : "?"}
									</Avatar.Fallback>
								</Avatar>
								<div className="flex flex-col flex-1 min-w-0">
									<span className="font-semibold text-accent-surface truncate">
										{c.name}
									</span>
									<span className="text-xs text-muted truncate">
										ID: {c.id}
									</span>
								</div>
								<Button
									isIconOnly
									size="sm"
									variant="ghost"
									className="text-warning opacity-0 group-hover:opacity-100 transition"
									onPress={() => openTrustModal(c.id)}
									aria-label="Manage Trust Factor"
								>
									<ShieldCheck className="w-4 h-4" />
								</Button>
							</div>
						))}
					</div>
				)}
			</ScrollShadow>

			{/* Trust Factor Modal */}
			<Modal isOpen={trustModalOpen} onOpenChange={setTrustModalOpen}>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Manage Trust Factor</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-muted">
									Set the trust factor for this contact. This restricts what
									actions they can perform.
								</p>
								<div className="flex flex-col gap-4 mt-4">
									<Slider
										step={50}
										maxValue={100}
										minValue={0}
										value={trustLevel}
										onChange={(value) => setTrustLevel(value as number)}
										className="w-full max-w-md px-1"
									>
										<Slider.Track className="bg-surface-secondary">
											<Slider.Fill className="bg-primary" />
											<Slider.Thumb className="border-primary" />
										</Slider.Track>
									</Slider>
									<div className="flex justify-between text-xs text-muted">
										<span>0 (Untrusted)</span>
										<span>50 (Normal)</span>
										<span>100 (Full Trust)</span>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="ghost"
									className="text-danger"
									onPress={() => setTrustModalOpen(false)}
								>
									Cancel
								</Button>
								<Button variant="primary" onPress={handleSaveTrustFactor}>
									Save Changes
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>

			{/* Add Contact Modal */}
			<Modal isOpen={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Add Contact</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-muted">
									Enter the User ID of the person you want to add.
								</p>
								<div className="flex flex-col gap-3 mt-3 px-1 py-1">
									<Input
										placeholder="User ID..."
										value={newUserId}
										onChange={(e) => setNewUserId(e.target.value)}
										variant="secondary"
									/>
									{addError && (
										<span className="text-xs text-danger">{addError}</span>
									)}
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="ghost"
									className="text-danger"
									onPress={() => setIsAddModalOpen(false)}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									isDisabled={isAdding || !newUserId.trim()}
									onPress={handleAddContact}
								>
									{isAdding ? "Adding..." : "Add"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</div>
	);
}
