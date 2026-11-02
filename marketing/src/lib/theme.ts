import { ANALYTICS_CONSENT_KEY, ANALYTICS_POLICY_VERSION } from "./analyticsConsent";

/**
 * Inline <head> script, run before first paint. `js` on <html> scopes the motion start states, so without
 * JS the page renders its final frame. The site has one light theme for every visitor, so it pins the light
 * colour scheme (form controls, scrollbars, autofill) and reads no stored theme choice.
 *
 * `consent-known` (no answer needed: Global Privacy Control, or an Allow/No thanks stored for this policy
 * version, the same rule as readAnalyticsConsent) hides the server-rendered analytics bar before it paints,
 * so the bar shows with the page for a first visit instead of after hydration (it was the home page's LCP).
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");d.style.colorScheme="light";try{var n=window.navigator;if(n&&n.globalPrivacyControl===true){d.classList.add("consent-known")}else{var r=JSON.parse(window.localStorage.getItem(${JSON.stringify(ANALYTICS_CONSENT_KEY)})||"null");if(r&&typeof r==="object"&&r.v===${JSON.stringify(ANALYTICS_POLICY_VERSION)}&&(r.choice==="allow"||r.choice==="deny"))d.classList.add("consent-known")}}catch(e){}})()`;
