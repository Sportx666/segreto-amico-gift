export const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
export const absUrl = (path: string) => `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
