import type { IconType } from "react-icons";
import { FaInstagram, FaFacebook } from "react-icons/fa6";
import {
  HiOutlineGlobeAlt,
  HiOutlineUsers,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineEllipsisHorizontalCircle,
} from "react-icons/hi2";
import styles from "./component-styles/channelIcon.module.css";
import { channelLabel, type Channel } from "../../lib/outreach";

/** An outreach channel, or "website" for a lead that came in through the enquiry form */
export type LeadChannel = Channel | "website";

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

export function ChannelIcon({ channel, size = 16 }: { channel: LeadChannel; size?: number }) {
  const Icon = channel === "website" ? HiOutlineGlobeAlt : CHANNEL_ICONS[channel];
  return <Icon size={size} aria-hidden="true" />;
}

export const leadChannelLabel = (channel: LeadChannel) => (channel === "website" ? "Website" : channelLabel(channel));

/** A channel's icon and name side by side, for table cells and card details */
export function ChannelLabel({ channel, size = 16 }: { channel: LeadChannel; size?: number }) {
  return (
    <span className={styles.channel}>
      <ChannelIcon channel={channel} size={size} />
      {leadChannelLabel(channel)}
    </span>
  );
}
