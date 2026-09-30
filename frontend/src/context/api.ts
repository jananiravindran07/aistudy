import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:5000/api`,
  withCredentials: true,
});