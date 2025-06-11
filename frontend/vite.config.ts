import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vault',
        short_name: 'Vault',
        description: 'Your self-hosted file & knowledge manager',
        start_url: '/',
        display: 'standalone',
        background_color: '#2D2D2D',
        theme_color: '#F97316',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    }),
    tailwindcss()    // ← zero-config Tailwind for Vite
  ],
});
