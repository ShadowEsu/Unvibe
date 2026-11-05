/**
 * The branded intro (Preston 21:5x via BOSS, ledger 469; Design's vibrant B storyboard): the Vibe mark
 * and the name over the page for 1.0 s, once per browser session. It only overlays: the page renders
 * underneath from the first byte, so it never holds back the LCP. The overlay is in every server HTML but
 * hidden unless this boot script sets `data-intro` on <html> before first paint; no JS, reduced motion and
 * a second page view in the same session never see it. Any click, tap, key or wheel ends it at once.
 */
export const INTRO_KEY = "unvibe-intro";
/** The CSS (b.css) has faded the overlay out by INTRO_MS; the attribute comes off then too. */
export const INTRO_MS = 1000;

export const INTRO_SCRIPT = `(function(){try{var d=document.documentElement,s=window.sessionStorage;if(s.getItem(${JSON.stringify(INTRO_KEY)})||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;s.setItem(${JSON.stringify(INTRO_KEY)},"1");d.setAttribute("data-intro","");var ev=["pointerdown","keydown","wheel","touchstart"];function end(){d.removeAttribute("data-intro");ev.forEach(function(e){window.removeEventListener(e,end,true)})}ev.forEach(function(e){window.addEventListener(e,end,{capture:true,passive:true})});setTimeout(end,${INTRO_MS})}catch(e){}})()`;
