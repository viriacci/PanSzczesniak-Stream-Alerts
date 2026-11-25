import type { ReactNode } from 'react'
export type IconName = 'dashboard'|'activity'|'chart'|'queue'|'bell'|'gift'|'studio'|'folder'|'layers'|'plug'|'settings'|'shield'|'book'|'sidebar'|'inspector'|'chevron'|'clock'|'users'|'bolt'|'search'|'close'|'text'|'image'|'video'|'audio'|'shape'|'play'|'pause'|'stop'|'undo'|'redo'|'crop'|'save'
const paths: Record<IconName, ReactNode> = {
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
 activity:<path d="M2 12h5l3-7 4 14 3-7h5"/>,
 chart:<><path d="M3 3v18h18M7 16l4-5 4 2 6-8"/></>,
 queue:<><path d="M9 5h12M9 12h12M9 19h12"/><path d="M3 5h1M3 12h1M3 19h1"/></>,
 bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
 gift:<><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8C1 8 6-3 12 8c6-11 11 0 0 0Z"/></>,
 studio:<><path d="m4 20 4-1L20 7l-3-3L5 16l-1 4ZM14 7l3 3M4 5h5M6.5 2.5v5"/></>,
 folder:<path d="M3 6h7l2 2h9v12H3z"/>,
 layers:<><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
 plug:<path d="M8 3v5m8-5v5M5 8h14v3a7 7 0 0 1-7 7v4M12 18a7 7 0 0 1-7-7"/>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="7"/></>,
 shield:<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>,
 book:<><path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Z"/></>,
 sidebar:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
 inspector:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
 chevron:<path d="m9 18 6-6-6-6"/>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/></>,
 bolt:<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>,
 search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
 close:<path d="m6 6 12 12M18 6 6 18"/>,
 text:<path d="M4 5h16M12 5v15M8 20h8M4 5v4M20 5v4"/>,
 image:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
 video:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></>,
 audio:<><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></>,
 shape:<><rect x="3" y="3" width="12" height="12" rx="2"/><circle cx="16" cy="16" r="5"/></>,
 play:<path d="m8 4 13 8-13 8Z"/>,pause:<path d="M9 5v14M15 5v14"/>,stop:<rect x="6" y="6" width="12" height="12" rx="1"/>,
 undo:<path d="m9 5-6 6 6 6M3 11h10a6 6 0 0 1 6 6"/>,redo:<path d="m15 5 6 6-6 6M21 11H11a6 6 0 0 0-6 6"/>,
 crop:<path d="M6 2v16h16M2 6h16v16"/>,save:<><path d="M4 3h13l3 3v15H4Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></>
}
export function Icon({name,size=18}: {name: IconName; size?: number}) {return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>}
