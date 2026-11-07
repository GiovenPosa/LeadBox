import type { IconType } from "react-icons";
import { FaInstagram, FaFacebook } from "react-icons/fa6";
import {
  HiOutlineUsers,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineEllipsisHorizontalCircle,
} from "react-icons/hi2";
import type { Channel } from "../../lib/outreach";

// One icon per outreach channel, used in the editor's dropdown and the table.
// Heroicons has no brand logos, so Instagram and Facebook come from Font
// Awesome, in the same react-icons package.
export const CHANNEL_ICONS: Record<Channel, IconType> = {
  instagram: FaInstagram,
  facebook: FaFacebook,
  in_person: HiOutlineUsers,
  email: HiOutlineEnvelope,
  phone: HiOutlinePhone,
  other: HiOutlineEllipsisHorizontalCircle,
};

export function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  const Icon = CHANNEL_ICONS[channel];
  return <Icon size={size} aria-hidden="true" />;
}
