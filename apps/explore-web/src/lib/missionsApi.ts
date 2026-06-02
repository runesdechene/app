import { supabase } from './supabase'
import type { MissionState, MissionSubmission, MySubmissionStatus } from '../types/mission'

export async function getMissionState(slug: string): Promise<MissionState | null> {
  const { data, error } = await supabase.rpc('get_mission_state', { p_slug: slug })
  if (error) throw error
  return (data as MissionState | null) ?? null
}
export async function getMissionSubmissions(slug: string): Promise<MissionSubmission[]> {
  const { data, error } = await supabase.rpc('get_mission_submissions', { p_slug: slug })
  if (error) throw error
  return (data as MissionSubmission[]) ?? []
}
export async function getMySubmissionStatus(slug: string): Promise<MySubmissionStatus> {
  const { data, error } = await supabase.rpc('get_my_mission_submission_status', { p_slug: slug })
  if (error) throw error
  return (data as MySubmissionStatus) ?? null
}
export async function joinMission(slug: string): Promise<void> {
  const { error } = await supabase.rpc('join_mission', { p_mission_slug: slug })
  if (error) throw error
}
export async function sendMissionMessage(slug: string, content: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('send_mission_message', { p_mission_slug: slug, p_content: content })
  if (error) return { success: false, error: error.message }
  const d = data as { success: boolean; error?: string }
  return { success: d.success, error: d.error }
}
export async function markMissionRead(slug: string): Promise<void> {
  await supabase.rpc('mark_mission_messages_read', { p_mission_slug: slug })
}
