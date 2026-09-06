import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base works for GitHub project Pages (…/repo/) and local preview.
export default defineConfig({
  plugins: [react()],
  base: './',
})
