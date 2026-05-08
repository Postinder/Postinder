import { useRef, useCallback } from 'react'

export function useSwipe({ onApprove, onReject, threshold = 80 }) {
  const drag = useRef({ on: false, sx: 0, sy: 0, cx: 0, cy: 0 })
  const cardRef = useRef(null)

  const onStart = useCallback((e) => {
    const card = cardRef.current
    if (!card) return
    const pt = e.touches ? e.touches[0] : e
    drag.current = { on: true, sx: pt.clientX, sy: pt.clientY, cx: pt.clientX, cy: pt.clientY }
    card.style.transition = 'none'

    const onMove = (ev) => {
      if (!drag.current.on) return
      if (ev.cancelable) ev.preventDefault()
      const p = ev.touches ? ev.touches[0] : ev
      drag.current.cx = p.clientX
      drag.current.cy = p.clientY
      const dx = drag.current.cx - drag.current.sx
      const dy = drag.current.cy - drag.current.sy
      card.style.transform = `translateX(${dx}px) translateY(${dy * 0.15}px) rotate(${dx * 0.08}deg)`
      // Update hints
      const ahn = card.querySelector('.hint-approve')
      const rhn = card.querySelector('.hint-reject')
      if (ahn) ahn.style.opacity = dx > 60 ? Math.min(1, (dx - 60) / 60) : 0
      if (rhn) rhn.style.opacity = dx < -60 ? Math.min(1, (-dx - 60) / 60) : 0
    }

    const onEnd = () => {
      drag.current.on = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchend', onEnd)
      const dx = drag.current.cx - drag.current.sx
      if (dx > threshold) onApprove()
      else if (dx < -threshold) onReject()
      else {
        card.style.transition = 'transform 0.3s'
        card.style.transform = ''
        const ahn = card.querySelector('.hint-approve')
        const rhn = card.querySelector('.hint-reject')
        if (ahn) ahn.style.opacity = 0
        if (rhn) rhn.style.opacity = 0
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
  }, [onApprove, onReject, threshold])

  return { cardRef, onStart }
}
