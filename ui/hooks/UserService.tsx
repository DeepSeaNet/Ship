import { invoke } from '@tauri-apps/api/core'

export const SetUserStatus = async (status: string) => {
  const response = await invoke('set_user_status', { status })
  return response
}

export const GetUserStatus = async (user_id: number) => {
  const response = await invoke('get_user_info', { userId: user_id })
  console.log(response)
  return response
}
