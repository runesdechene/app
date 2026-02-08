import { supabase } from '@/shared/supabase/client'
import { ApiMyInformations } from '@model'
import {
  ActivateAccountRequestModel,
  ChangeEmailAddressRequestModel,
  ChangeInformationsRequestModel,
  IAccountGateway,
} from '@ports'

export class SupabaseAccountGateway implements IAccountGateway {
  constructor(private readonly getUserId: () => string | null) {}

  async getMyUser(): Promise<ApiMyInformations> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { data, error } = await supabase.rpc('get_my_informations', {
      p_user_id: userId,
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data as ApiMyInformations
  }

  async changeInformations(
    req: ChangeInformationsRequestModel,
  ): Promise<any> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const updates: Record<string, any> = {}
    if (req.lastName !== undefined) updates.last_name = req.lastName
    if (req.gender !== undefined) updates.gender = req.gender
    if (req.biography !== undefined) updates.bio = req.biography
    if (req.profileImageId !== undefined)
      updates.profile_image_id = req.profileImageId
    if (req.instagramId !== undefined) updates.instagram_id = req.instagramId
    if (req.websiteUrl !== undefined) updates.website_url = req.websiteUrl

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) throw error
  }

  async changeEmailAddress(
    req: ChangeEmailAddressRequestModel,
  ): Promise<any> {
    const { error } = await supabase.auth.updateUser({
      email: req.emailAddress,
    })

    if (error) throw error
  }

  async activateAccount(req: ActivateAccountRequestModel): Promise<any> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    // Consume the member code and upgrade rank
    const { data: code, error: codeError } = await supabase
      .from('member_codes')
      .select('*')
      .eq('code', req.code)
      .eq('is_consumed', false)
      .single()

    if (codeError || !code) throw new Error('Invalid member code')

    // Mark code as consumed
    const { error: updateCodeError } = await supabase
      .from('member_codes')
      .update({ is_consumed: true, user_id: userId })
      .eq('id', code.id)

    if (updateCodeError) throw updateCodeError

    // Upgrade user rank
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ rank: 'member' })
      .eq('id', userId)

    if (updateUserError) throw updateUserError
  }

  async deleteAccount(): Promise<any> {
    // Supabase admin API is needed for account deletion
    // For now, we deactivate the account
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)

    if (error) throw error

    await supabase.auth.signOut()
  }
}
