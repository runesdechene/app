export interface MissionFloor { glory: number; crowns: number }
export interface MissionState {
  slug: string; title: string; eyebrow: string | null; call: string | null
  brief: string | null; emblem: string | null; coverImageUrl: string | null
  deliverableKind: 'photo' | 'video' | 'other'
  productHandle: string | null; ctaLabel: string | null; ctaUrl: string | null
  pactQuestion: string | null; promoCode: string | null; promoNote: string | null
  startsAt: string | null; endsAt: string | null
  floor: MissionFloor; rewardHint: string | null; salonIntro: string | null
  status: 'draft' | 'published' | 'passed' | 'archived'
  participantsCount: number; isParticipant: boolean
}
export interface MissionSubmission {
  submissionId: string; imageUrl: string; submitterName: string; createdAt: string
}
export type MySubmissionStatus = 'pending' | 'approved' | 'archived' | null
export interface MissionParticipant {
  userId: string; name: string | null; avatar: string | null; joinedAt: string
}
export interface MissionParticipantsPayload {
  total: number; participants: MissionParticipant[]
}
