import {
  Briefcase,
  Code2,
  Globe2,
  LayoutTemplate,
  Megaphone,
  MousePointerClick,
  Palette,
  Search,
  Share2,
  Smartphone,
  Target,
  Video,
} from "lucide-react";

/**
 * Pick a lucide icon for a service name (SMM, SEO, Website, Ads, etc.).
 */
export function getServiceIcon(name = "") {
  const text = String(name).toLowerCase();

  if (/smm|social|instagram|facebook|linkedin|twitter|reel|post/.test(text)) return Share2;
  if (/seo|search|rank|keyword/.test(text)) return Search;
  if (/meta\s*ads|facebook\s*ads|instagram\s*ads|ppc|google\s*ads|ads?$|advertis|campaign/.test(text)) {
    return Megaphone;
  }
  if (/website|web\s*dev|web\s*design|site|wordpress|landing/.test(text)) return Globe2;
  if (/app|android|ios|mobile/.test(text)) return Smartphone;
  if (/ui|ux|design|brand|logo|graphic/.test(text)) return Palette;
  if (/video|youtube|reels?|shoot/.test(text)) return Video;
  if (/content|copy|blog|article/.test(text)) return LayoutTemplate;
  if (/lead|funnel|conversion/.test(text)) return Target;
  if (/click|cta/.test(text)) return MousePointerClick;
  if (/develop|software|code|api/.test(text)) return Code2;

  return Briefcase;
}

export function serviceIconTone(name = "") {
  const text = String(name).toLowerCase();
  if (/smm|social/.test(text)) return "bg-sky-50 text-sky-700 border-sky-200";
  if (/seo/.test(text)) return "bg-violet-50 text-violet-700 border-violet-200";
  if (/ads|ppc|campaign|meta/.test(text)) return "bg-amber-50 text-amber-800 border-amber-200";
  if (/website|web|site/.test(text)) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (/app|mobile/.test(text)) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (/design|ui|ux|brand/.test(text)) return "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}
