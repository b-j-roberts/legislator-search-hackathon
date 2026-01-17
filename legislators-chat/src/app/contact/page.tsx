"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useContact } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressStepper } from "@/components/layout";
import type { Legislator, Party } from "@/lib/types";

const partyConfig: Record<Party, { label: string; color: string }> = {
  D: { label: "Democrat", color: "bg-blue-500" },
  R: { label: "Republican", color: "bg-red-500" },
  I: { label: "Independent", color: "bg-purple-500" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface LegislatorContactCardProps {
  legislator: Legislator;
  onRemove: (id: string) => void;
}

function LegislatorContactCard({ legislator, onRemove }: LegislatorContactCardProps) {
  const { name, party, state, chamber, district, contact, imageUrl } = legislator;
  const partyColor = partyConfig[party].color;
  const location = district ? `${state}-${district}` : state;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn("rounded-full p-0.5", partyColor)}>
            <Avatar className="size-10">
              {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
              <AvatarFallback className="text-sm font-medium">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{name}</CardTitle>
            <CardDescription>
              {chamber === "House" ? "Representative" : "Senator"} · {location}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(legislator.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {contact.phone && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5"
            >
              <a href={`tel:${contact.phone}`}>
                <Phone className="size-3.5" />
                {contact.phone}
              </a>
            </Button>
          )}
          {contact.email && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5"
            >
              <a href={`mailto:${contact.email}`}>
                <Mail className="size-3.5" />
                Email
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No representatives selected
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Go back to the research phase to select representatives you'd like to contact.
      </p>
      <Button asChild>
        <Link href="/">
          <ArrowLeft className="size-4 mr-2" />
          Back to Research
        </Link>
      </Button>
    </div>
  );
}

export default function ContactPage() {
  const router = useRouter();
  const {
    selectedLegislators,
    deselectLegislator,
    currentStep,
    setCurrentStep,
    hasSelections,
    selectionCount,
  } = useContact();

  // Ensure we're on the contact step
  React.useEffect(() => {
    if (currentStep !== "contact") {
      setCurrentStep("contact");
    }
  }, [currentStep, setCurrentStep]);

  const handleBack = () => {
    setCurrentStep("research");
    router.push("/");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header with stepper */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back to Research
            </Button>
            <ProgressStepper currentStep="contact" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contact Your Representatives
            </h1>
            <p className="text-muted-foreground mt-1">
              {hasSelections
                ? `You have ${selectionCount} representative${selectionCount !== 1 ? "s" : ""} selected`
                : "Select representatives to contact them"}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {!hasSelections ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/50">
                <AlertCircle className="size-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Ready to make your voice heard
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Use the contact information below to reach out to your representatives.
                    Call scripts and email templates are coming soon.
                  </p>
                </div>
              </div>

              {/* Selected legislators */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Selected Representatives
                </h2>
                <div className="space-y-3">
                  {selectedLegislators.map((legislator, index) => (
                    <motion.div
                      key={legislator.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <LegislatorContactCard
                        legislator={legislator}
                        onRemove={deselectLegislator}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Coming soon section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Coming Soon
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          <Phone className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Call Scripts</h3>
                          <p className="text-sm text-muted-foreground">
                            AI-generated scripts based on your research
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          <Mail className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Email Drafts</h3>
                          <p className="text-sm text-muted-foreground">
                            Personalized email templates ready to send
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
