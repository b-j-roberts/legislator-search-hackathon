'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { ExternalLink, Phone, Mail, Globe, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Legislator, Party } from '@/types/legislator'

const partyColors: Record<Party, string> = {
  Democrat: 'bg-blue-600 hover:bg-blue-700',
  Republican: 'bg-red-600 hover:bg-red-700',
  Independent: 'bg-purple-600 hover:bg-purple-700',
}

const partyAbbrev: Record<Party, string> = {
  Democrat: 'D',
  Republican: 'R',
  Independent: 'I',
}

interface LegislatorCardProps {
  legislator: Legislator
  className?: string
}

export function LegislatorCard({ legislator, className }: LegislatorCardProps) {
  const {
    name,
    party,
    chamber,
    state,
    district,
    photo,
    issueBlurb,
    contactInfo,
    socialMedia,
    tags,
    relevantLinks,
  } = legislator

  const location =
    chamber === 'House' && district ? `${state}-${district}` : state

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex gap-4">
            <div className="bg-muted relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {photo ? (
                <Image src={photo} alt={name} fill className="object-cover" />
              ) : (
                <span className="text-muted-foreground text-xl font-semibold">
                  {name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold">{name}</h3>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <span>{chamber}</span>
                <span>•</span>
                <MapPin className="h-3 w-3" />
                <span>{location}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge className={`${partyColors[party]} text-white`}>
                  {partyAbbrev[party]} - {party}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{issueBlurb}</p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="border-border space-y-2 border-t pt-4">
            {contactInfo.phone && (
              <a
                href={`tel:${contactInfo.phone}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{contactInfo.phone}</span>
              </a>
            )}
            {contactInfo.email && (
              <a
                href={`mailto:${contactInfo.email}`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>{contactInfo.email}</span>
              </a>
            )}
            {contactInfo.website && (
              <a
                href={contactInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>Official Website</span>
              </a>
            )}
          </div>

          {relevantLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Related Links</h4>
              <div className="flex flex-wrap gap-2">
                {relevantLinks.slice(0, 3).map((link) => (
                  <Button
                    key={link.url}
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-auto py-1 text-xs"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.title}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {socialMedia && (socialMedia.twitter || socialMedia.facebook) && (
            <div className="flex gap-2">
              {socialMedia.twitter && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`https://twitter.com/${socialMedia.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{socialMedia.twitter}
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
