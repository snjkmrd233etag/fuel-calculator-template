import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fuel Calculator - Road Trip Cost Planner',
    short_name: 'Road Cost Planner',
    description:
      'Fuel and road trip cost calculator with multi-unit support, trip history, and vehicle profiles.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
