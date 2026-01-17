'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StateFilter } from './state-filter'
import type { Party, Chamber, SearchFilters } from '@/types/legislator'

const PARTIES: Party[] = ['Democrat', 'Republican', 'Independent']
const CHAMBERS: Chamber[] = ['House', 'Senate']
const COMMON_TAGS = [
  'Congressional Black Caucus',
  'Congressional Hispanic Caucus',
  'Congressional Asian Pacific American Caucus',
  'Congressional Progressive Caucus',
  'Freedom Caucus',
  'Blue Dog Coalition',
  'Problem Solvers Caucus',
  'New Democrat Coalition',
]

interface AdvancedFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  className?: string
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  className,
}: AdvancedFiltersProps) {
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag]
    updateFilter('tags', newTags.length > 0 ? newTags : undefined)
  }

  const clearFilters = () => {
    onFiltersChange({ query: filters.query })
  }

  const hasActiveFilters =
    filters.state ||
    filters.party ||
    filters.chamber ||
    (filters.tags && filters.tags.length > 0)

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground h-auto p-0 text-sm hover:bg-transparent"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">State</label>
          <StateFilter
            value={filters.state || 'all'}
            onChange={(value) =>
              updateFilter('state', value === 'all' ? undefined : value)
            }
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Party</label>
          <Select
            value={filters.party || 'all'}
            onValueChange={(value) =>
              updateFilter(
                'party',
                value === 'all' ? undefined : (value as Party)
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {PARTIES.map((party) => (
                <SelectItem key={party} value={party}>
                  {party}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Chamber</label>
          <Select
            value={filters.chamber || 'all'}
            onValueChange={(value) =>
              updateFilter(
                'chamber',
                value === 'all' ? undefined : (value as Chamber)
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Chambers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chambers</SelectItem>
              {CHAMBERS.map((chamber) => (
                <SelectItem key={chamber} value={chamber}>
                  {chamber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Caucus / Tags</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map((tag) => {
              const isSelected = filters.tags?.includes(tag)
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {isSelected && <X className="ml-1 h-3 w-3" />}
                </Badge>
              )
            })}
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="border-border space-y-2 border-t pt-4">
          <label className="text-sm font-medium">Active Filters</label>
          <div className="flex flex-wrap gap-2">
            {filters.state && (
              <Badge variant="secondary" className="gap-1">
                State: {filters.state}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('state', undefined)}
                />
              </Badge>
            )}
            {filters.party && (
              <Badge variant="secondary" className="gap-1">
                {filters.party}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('party', undefined)}
                />
              </Badge>
            )}
            {filters.chamber && (
              <Badge variant="secondary" className="gap-1">
                {filters.chamber}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => updateFilter('chamber', undefined)}
                />
              </Badge>
            )}
            {filters.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => toggleTag(tag)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
