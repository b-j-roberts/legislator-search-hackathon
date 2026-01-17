'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { SearchBar } from '@/components/search-bar'
import { AdvancedFilters } from '@/components/advanced-filters'
import { LegislatorCard } from '@/components/legislator-card'
import { Button } from '@/components/ui/button'
import type { Legislator, SearchFilters } from '@/types/legislator'

const MOCK_LEGISLATORS: Legislator[] = [
  {
    id: '1',
    name: 'Alexandria Ocasio-Cortez',
    party: 'Democrat',
    chamber: 'House',
    state: 'NY',
    district: '14',
    issueBlurb:
      'Strong advocate for the Green New Deal and Medicare for All. Has consistently voted for climate action legislation and supports aggressive carbon emission reduction targets.',
    contactInfo: {
      phone: '(202) 225-3965',
      website: 'https://ocasio-cortez.house.gov',
      office: '229 Cannon HOB, Washington, DC 20515',
    },
    socialMedia: {
      twitter: 'AOC',
    },
    tags: ['Congressional Progressive Caucus', 'Green New Deal Sponsor'],
    relevantLinks: [
      {
        title: 'Green New Deal Resolution',
        url: 'https://www.congress.gov/bill/116th-congress/house-resolution/109',
      },
      {
        title: 'Climate Voting Record',
        url: 'https://scorecard.lcv.org',
      },
    ],
  },
  {
    id: '2',
    name: 'Ted Cruz',
    party: 'Republican',
    chamber: 'Senate',
    state: 'TX',
    issueBlurb:
      'Opposes most climate regulations, citing economic concerns. Supports energy independence through domestic oil and gas production. Has voted against major environmental bills.',
    contactInfo: {
      phone: '(202) 224-5922',
      website: 'https://cruz.senate.gov',
      office: '127A Russell SOB, Washington, DC 20510',
    },
    socialMedia: {
      twitter: 'tedcruz',
    },
    tags: ['Senate Judiciary Committee'],
    relevantLinks: [
      {
        title: 'Energy Policy Positions',
        url: 'https://cruz.senate.gov/issues/energy',
      },
    ],
  },
  {
    id: '3',
    name: 'Bernie Sanders',
    party: 'Independent',
    chamber: 'Senate',
    state: 'VT',
    issueBlurb:
      'Leading voice on climate justice and healthcare reform. Introduced comprehensive climate legislation and supports transitioning to 100% renewable energy by 2050.',
    contactInfo: {
      phone: '(202) 224-5141',
      website: 'https://sanders.senate.gov',
      office: '332 Dirksen SOB, Washington, DC 20510',
    },
    socialMedia: {
      twitter: 'SenSanders',
    },
    tags: ['Congressional Progressive Caucus', 'Senate Budget Committee Chair'],
    relevantLinks: [
      {
        title: 'Climate Crisis Plan',
        url: 'https://berniesanders.com/issues/green-new-deal',
      },
    ],
  },
  {
    id: '4',
    name: 'Marjorie Taylor Greene',
    party: 'Republican',
    chamber: 'House',
    state: 'GA',
    district: '14',
    issueBlurb:
      'Skeptical of climate change policies, opposes Green New Deal. Advocates for reduced environmental regulations and increased domestic energy production.',
    contactInfo: {
      phone: '(202) 225-5211',
      website: 'https://greene.house.gov',
    },
    socialMedia: {
      twitter: 'RepMTG',
    },
    tags: ['Freedom Caucus'],
    relevantLinks: [],
  },
  {
    id: '5',
    name: 'Cory Booker',
    party: 'Democrat',
    chamber: 'Senate',
    state: 'NJ',
    issueBlurb:
      'Co-sponsor of environmental justice legislation. Supports comprehensive climate action including investments in clean energy and environmental justice communities.',
    contactInfo: {
      phone: '(202) 224-3224',
      website: 'https://booker.senate.gov',
      office: '717 Hart SOB, Washington, DC 20510',
    },
    socialMedia: {
      twitter: 'SenBooker',
    },
    tags: ['Congressional Black Caucus', 'Senate Environment Committee'],
    relevantLinks: [
      {
        title: 'Environmental Justice Act',
        url: 'https://www.congress.gov/bill/117th-congress/senate-bill/872',
      },
    ],
  },
  {
    id: '6',
    name: 'Hakeem Jeffries',
    party: 'Democrat',
    chamber: 'House',
    state: 'NY',
    district: '8',
    issueBlurb:
      'House Democratic Leader supporting climate investments through the Inflation Reduction Act. Advocates for clean energy jobs and environmental justice.',
    contactInfo: {
      phone: '(202) 225-5936',
      website: 'https://jeffries.house.gov',
    },
    socialMedia: {
      twitter: 'RepJeffries',
    },
    tags: ['Congressional Black Caucus', 'House Democratic Leader'],
    relevantLinks: [],
  },
]

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialQuery = searchParams.get('q') || ''
  const initialState = searchParams.get('state') || undefined

  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQuery,
    state: initialState,
  })
  const results = useMemo(() => {
    let filtered = MOCK_LEGISLATORS

    if (filters.state) {
      filtered = filtered.filter((l) => l.state === filters.state)
    }
    if (filters.party) {
      filtered = filtered.filter((l) => l.party === filters.party)
    }
    if (filters.chamber) {
      filtered = filtered.filter((l) => l.chamber === filters.chamber)
    }
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((l) =>
        filters.tags!.some((tag) => l.tags.includes(tag))
      )
    }

    return filtered
  }, [filters])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (filters.state) params.set('state', filters.state)

    router.push(`/search?${params.toString()}`)
    setFilters((prev) => ({ ...prev, query }))
  }

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters)

    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (newFilters.state) params.set('state', newFilters.state)
    if (newFilters.party) params.set('party', newFilters.party)
    if (newFilters.chamber) params.set('chamber', newFilters.chamber)

    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="min-h-screen">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            className="max-w-xl flex-1"
          />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-72">
            <div className="lg:sticky lg:top-24">
              <AdvancedFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
              />
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">
                {filters.query ? (
                  <>Results for &ldquo;{filters.query}&rdquo;</>
                ) : (
                  'All Legislators'
                )}
              </h1>
              <p className="text-muted-foreground">
                {results.length} legislator{results.length !== 1 ? 's' : ''}{' '}
                found
              </p>
            </div>

            {results.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: { staggerChildren: 0.05 },
                  },
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
                {results.map((legislator) => (
                  <LegislatorCard key={legislator.id} legislator={legislator} />
                ))}
              </motion.div>
            ) : (
              <div className="text-muted-foreground py-12 text-center">
                <p className="text-lg">
                  No legislators found matching your criteria.
                </p>
                <p className="mt-2">
                  Try adjusting your filters or search terms.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
