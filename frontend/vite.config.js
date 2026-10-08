import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // let a phone on the same Wi-Fi preview via your LAN IP
    proxy: { '/api': 'http://localhost:4123' },
  },
})
