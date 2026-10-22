import { useEffect } from 'react'

/** Aplica a matiz da organização (RF06) ao tema da página. */
export function useBrandHue(hue: number | undefined) {
  useEffect(() => {
    if (hue == null) return
    document.documentElement.style.setProperty('--brand-h', String(hue))
  }, [hue])
}
