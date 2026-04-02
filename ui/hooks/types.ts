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
