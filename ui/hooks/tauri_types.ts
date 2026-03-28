import type { GroupConfig, Message } from "./messengerTypes";

export type TauriGroup = {
	group_id: string;
	group_config: GroupConfig;
	last_message: Message;
	avatar: string;
};
