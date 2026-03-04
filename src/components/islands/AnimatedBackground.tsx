import { useEffect, useRef } from 'react'

/**
 * Full-screen animated gradient background with floating bubbles
 * Matches the kokomo.house signature look: blue/green/beige gradient with soft circles
 */

// KOKOMO brand colors
const COLORS = {
  blue: '#00B2FF',
  green: '#00FF7F',
  beige: '#E6C288',
}

interface Bubble {
  x: number
  y: number
  radius: number
  speedX: number
  speedY: number
  color: string
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const bubblesRef = useRef<Bubble[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = document.documentElement.scrollHeight
    }

    function createBubbles() {
      if (!canvas) return
      const count = Math.min(Math.floor(window.innerWidth / 80), 20)
      const colorKeys = [COLORS.blue, COLORS.green, COLORS.beige]

      bubblesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 30 + Math.random() * 80,
        speedX: prefersReducedMotion ? 0 : (Math.random() * 0.5 - 0.25),
        speedY: prefersReducedMotion ? 0 : (Math.random() * 0.5 - 0.25),
        color: colorKeys[Math.floor(Math.random() * colorKeys.length)],
      }))
    }

    function drawGradient() {
      if (!canvas || !ctx) return

      // Main gradient background: blue-left → green-center → beige-right
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, 'rgba(0, 178, 255, 0.75)')    // Blue
      gradient.addColorStop(0.45, 'rgba(0, 255, 127, 0.50)')  // Green
      gradient.addColorStop(1, 'rgba(230, 194, 136, 0.70)')   // Beige
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    function drawBubbles() {
      if (!canvas || !ctx) return

      for (const bubble of bubblesRef.current) {
        bubble.x += bubble.speedX
        bubble.y += bubble.speedY

        // Bounce off edges
        if (bubble.x < 0 || bubble.x > canvas.width) bubble.speedX *= -1
        if (bubble.y < 0 || bubble.y > canvas.height) bubble.speedY *= -1

        // Draw filled circle with transparency
        ctx.beginPath()
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2)
        ctx.fillStyle = bubble.color + '30' // ~19% opacity
        ctx.fill()

        // Draw soft stroke
        ctx.strokeStyle = bubble.color + '18' // ~9% opacity
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    function animate() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      drawGradient()
      drawBubbles()

      animationRef.current = requestAnimationFrame(animate)
    }

    resize()
    createBubbles()

    if (prefersReducedMotion) {
      // Draw once, no animation loop
      drawGradient()
      drawBubbles()
    } else {
      animate()
    }

    const handleResize = () => {
      resize()
      createBubbles()
    }

    window.addEventListener('resize', handleResize)

    // Re-measure page height when content changes
    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        canvas.height = document.documentElement.scrollHeight
      }
    })
    resizeObserver.observe(document.body)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  )
}
