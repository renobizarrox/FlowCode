import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'dark',
      themes: {
        dark: {
          dark: true,
          colors: {
            primary: '#0078d4',
            secondary: '#2d2d2d',
            accent: '#10ff10',
            error: '#ff4444',
            info: '#0891b2',
            success: '#059669',
            warning: '#ff8800',
            background: '#1a1a1a',
            surface: '#2d2d2d',
          }
        }
      }
    },
    defaults: {
      VBtn: {
        style: 'text-transform: none;'
      }
    }
  })

  nuxtApp.vueApp.use(vuetify)
}) 