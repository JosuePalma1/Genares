// Las capacidades devueltas por NestJS controlan las operaciones de cada identidad.
export const FUENTE_RUBRICAS = 'api';
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
