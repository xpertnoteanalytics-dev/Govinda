"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Star,
  Phone,
  Globe,
  ExternalLink,
  Clock,
  PhoneCall,
  Mail,
  MessageCircle,
} from "lucide-react";
import { CallScriptModal } from "@/components/calls/CallScriptModal";
import { EmailComposeModal } from "@/components/outreach/EmailComposeModal";
import { WhatsAppComposeModal } from "@/components/outreach/WhatsAppComposeModal";
import { ActionButton } from "@/components/ui/ActionButton";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/lib/places-api";
import type { PlaceResult } from "@/lib/places-types";
import { CATEGORY_META } from "@/lib/places-types";

interface PlaceCardProps {
  place: PlaceResult;
  index?: number;
}

export function PlaceCard({ place, index = 0 }: PlaceCardProps) {
  const [callOpen, setCallOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const categoryStyle = CATEGORY_META[place.category]?.color ?? "";

  return (
    <>
      <CallScriptModal open={callOpen} onClose={() => setCallOpen(false)} />
      <EmailComposeModal place={place} open={emailOpen} onClose={() => setEmailOpen(false)} />
      <WhatsAppComposeModal
        place={place}
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
      />
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        className="glass-panel group p-5"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                  categoryStyle
                )}
              >
                {CATEGORY_META[place.category].label}
              </span>
              {place.isOpen != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    place.isOpen
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "bg-slate-100 text-ink-muted dark:bg-white/5"
                  )}
                >
                  <Clock className="h-3 w-3" aria-hidden />
                  {place.openStatusText ?? (place.isOpen ? "Open" : "Closed")}
                </span>
              )}
            </div>

            <h3 className="mt-2.5 text-lg font-semibold tracking-tight text-ink dark:text-white">
              {place.name}
            </h3>

            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-ink-muted dark:text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
              {place.address}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm">
              {place.rating != null && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                  {place.rating.toFixed(1)}
                  {place.userRatingsTotal != null && (
                    <span className="font-normal text-ink-subtle">({place.userRatingsTotal})</span>
                  )}
                </span>
              )}
              {place.distanceMeters != null && (
                <span className="text-ink-muted dark:text-slate-500">
                  {formatDistance(place.distanceMeters)} away
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[11rem]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle dark:text-slate-500">
              Quick actions
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              {place.phone && (
                <>
                  <ActionButton variant="call" onClick={() => setCallOpen(true)} fullWidth>
                    <PhoneCall className="h-4 w-4" />
                    Call
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    href={`tel:${place.phone.replace(/\s/g, "")}`}
                    fullWidth
                  >
                    <Phone className="h-4 w-4" />
                    Direct
                  </ActionButton>
                </>
              )}
              <ActionButton variant="whatsapp" onClick={() => setWhatsappOpen(true)} fullWidth>
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </ActionButton>
              <ActionButton variant="email" onClick={() => setEmailOpen(true)} fullWidth>
                <Mail className="h-4 w-4" />
                Email
              </ActionButton>
              <ActionButton variant="maps" href={place.mapsUrl} target="_blank" rel="noopener noreferrer" fullWidth>
                <ExternalLink className="h-4 w-4" />
                Maps
              </ActionButton>
              {place.website && (
                <ActionButton
                  variant="outline"
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  className="col-span-2 sm:col-span-1"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </motion.article>
    </>
  );
}
