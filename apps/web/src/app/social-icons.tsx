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

/**
 * The two app-store marks.
 *
 * Unlike the social glyphs above these are *filled* rather than stroked: both
 * are registered brand marks whose recognisable shape is a solid silhouette,
 * and a stroked outline of either reads as a knock-off. They take `fill` from
 * `currentColor` so a tile can colour them the same way it colours the others.
 */
export const GooglePlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
  </svg>
);

export const AppStoreIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.035 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
);
