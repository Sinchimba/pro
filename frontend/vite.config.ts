import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // listen on all network interfaces (needed for --host / LAN testing)
    hmr: {
      // Without this, Vite's live-reload socket tries to reconnect to
      // "localhost:5173" even when you access the site via a LAN IP or
      // ngrok tunnel — which fails from another device's perspective.
      // clientPort matches whatever port the browser is actually using.
      clientPort: 5173,
    },
  },
})