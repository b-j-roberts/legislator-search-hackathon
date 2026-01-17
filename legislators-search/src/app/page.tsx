'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { SearchBar } from '@/components/search-bar'
import { StateFilter } from '@/components/state-filter'

export default function Home() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [state, setState] = useState('all')

  const handleSearch = () => {
    if (!query.trim()) return

    const params = new URLSearchParams()
    params.set('q', query.trim())
    if (state && state !== 'all') {
      params.set('state', state)
    }

    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl space-y-8 text-center"
      >
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find Your Legislators
          </h1>
          <p className="text-muted-foreground text-lg">
            Search by issue to discover where your representatives stand on the
            topics that matter to you.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-4"
        >
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
          />

          <div className="flex items-center justify-center gap-4">
            <span className="text-muted-foreground text-sm">
              Filter by state:
            </span>
            <StateFilter value={state} onChange={setState} className="w-48" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-muted-foreground space-y-2 pt-8 text-sm"
        >
          <p>Try searching for:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'healthcare',
              'climate change',
              'immigration',
              'gun control',
              'economy',
            ].map((topic) => (
              <button
                key={topic}
                onClick={() => {
                  setQuery(topic)
                }}
                className="hover:bg-muted rounded-full border px-3 py-1 transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
