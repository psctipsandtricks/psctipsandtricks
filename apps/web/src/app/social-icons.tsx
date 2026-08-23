import React from 'react';

/**
 * Lucide ships Instagram and YouTube glyphs but no Telegram one, so this is a
 * hand-drawn paper-plane mark kept in the same stroke style (round caps/joins,
 * `currentColor`, 24x24 viewport) so it drops into an icon slot next to the
 * other two without looking like an outlier.
 */
export const TelegramIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M21.5 3.5 2.75 10.8c-.9.35-.89 1.63.02 1.96l4.62 1.7 1.78 5.72c.24.77 1.22.98 1.76.38l2.55-2.83 4.7 3.47c.7.52 1.71.14 1.9-.72l3.02-14.03c.2-.94-.75-1.72-1.63-1.35Z" />
    <path d="M9.4 14.46 19.1 6.2" />
  </svg>
);

export { Instagram as InstagramIcon, Youtube as YoutubeIcon, Facebook as FacebookIcon, Twitter as TwitterIcon } from 'lucide-react';
