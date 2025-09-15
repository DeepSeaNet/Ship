import { GroupConfig } from '@/hooks/Group'

export interface CreateGroup {
  success: boolean
  group_id: string
  group_config: GroupConfig
}
