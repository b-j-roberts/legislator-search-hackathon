export type Party = 'Democrat' | 'Republican' | 'Independent'

export type Chamber = 'House' | 'Senate'

export interface ContactInfo {
  phone?: string
  email?: string
  website?: string
  office?: string
}

export interface SocialMedia {
  twitter?: string
  facebook?: string
}

export interface RelevantLink {
  title: string
  url: string
}

export interface Legislator {
  id: string
  name: string
  party: Party
  chamber: Chamber
  state: string
  district?: string
  photo?: string
  issueBlurb: string
  contactInfo: ContactInfo
  socialMedia?: SocialMedia
  tags: string[]
  relevantLinks: RelevantLink[]
}

export interface SearchFilters {
  query?: string
  state?: string
  party?: Party
  chamber?: Chamber
  tags?: string[]
}

export interface SearchResults {
  legislators: Legislator[]
  total: number
  query: string
  filters: SearchFilters
}
