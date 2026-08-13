import { Facebook, Globe2, Instagram, Linkedin, Mail, MapPin, MessageCircle, Music2, Youtube } from 'lucide-react'

const ICONS = {
  LinkedIn: Linkedin,
  TikTok: Music2,
  YouTube: Youtube,
  'Google Meu Negócio': MapPin,
  WhatsApp: MessageCircle,
  Site: Globe2,
  'E-mail Marketing': Mail,
}

export default function ChannelIcon({ channel, size = 16, className = '' }) {
  if (channel === 'Instagram/Facebook') {
    return (
      <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
        <Instagram size={size} strokeWidth={2.1} />
        <Facebook size={size} strokeWidth={2.1} />
      </span>
    )
  }

  const Icon = ICONS[channel] || Globe2
  return <Icon size={size} strokeWidth={2.1} className={className} aria-hidden="true" />
}
