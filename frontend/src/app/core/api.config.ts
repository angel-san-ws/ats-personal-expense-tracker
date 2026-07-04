/** Base URL of the NestJS API. Derived from the page's hostname so the app also works when opened from another device on the LAN (e.g. http://192.168.x.x:4200). */
export const API_BASE = `http://${window.location.hostname}:3000/api`;

/** Google OAuth client ID (must match GOOGLE_CLIENT_ID in backend/.env). */
export const GOOGLE_CLIENT_ID =
  '175109236979-urahuql29imsi48hm34moebnndhlf7a6.apps.googleusercontent.com';
