// Where the e-mail link may send the user after the code is exchanged. A fixed list, never an arbitrary address.
const ALLOWED = ["/", "/onboarding", "/reset-password"];
export const safeCallbackNext = (value) => (ALLOWED.includes(String(value || "")) ? String(value) : "/");
