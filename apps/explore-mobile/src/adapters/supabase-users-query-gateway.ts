import { supabase } from '@/shared/supabase/client'
import { ApiUserProfile } from '@model'
import { IUsersQueryGateway } from '@ports'

export class SupabaseUsersQueryGateway implements IUsersQueryGateway {
  async getUserProfile(userId: string): Promise<ApiUserProfile> {
    const { data, error } = await supabase.rpc('get_user_profile', {
      p_user_id: userId,
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data as ApiUserProfile
  }
}
