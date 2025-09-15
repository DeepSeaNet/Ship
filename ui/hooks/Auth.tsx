import { invoke } from '@tauri-apps/api/core'

export const register = async (
  username: string,
  email: string,
  password: string,
) => {
  const result: RegisterResult = await invoke('grpc_register', {
    username,
    email,
    password,
  })
  return result
}

export const login = async (username: string) => {
  const result: LoginResult = await invoke('grpc_login', { username })
  return result
}

export const import_account = async (
  import_data: string,
  import_key: string,
) => {
  const result: number = await invoke('import_account', {
    exportedAccount: import_data,
    key: import_key,
  })
  return result
}

type LoginResult = {
  user_id: number
  username: string
  public_address: string
  server_address: string
  server_pub_key: string
}

type RegisterResult = {
  user_id: number
  username: string
}

export type Account = {
  username: string
  user_id: number
  public_address: string
  server_address: string
}
