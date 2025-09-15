import { config } from '@/config/env';

export const baseUrl = config.app.baseUrl;
export const absUrl = (path: string) => `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
