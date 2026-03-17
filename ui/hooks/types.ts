export type Account = {
	username: string;
	user_id: number;
	public_address: string;
	server_address: string;
	avatar_url?: string;
	encrypted?: boolean;
};

export type RegisterResult = {
	success: boolean;
	message?: string;
};

export type LoginResult = {
	user_id: number;
	username: string;
	public_address: string;
	server_address: string;
	server_pub_key: string;
};
