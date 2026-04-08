import { useEffect, useRef } from 'react'

const DEFAULTS = {
  count: 300,
  magnetRadius: 10,
  ringRadius: 10,
  waveSpeed: 0.4,
  waveAmplitude: 1,
  particleSize: 2,
  lerpSpeed: 0.1,
  color: '#111111',
  autoAnimate: false,
  particleVariance: 1,
  rotationSpeed: 0,
  depthFactor: 1,
  pulseSpeed: 3,
  particleShape: 'capsule',
  fieldStrength: 10,
}

export function Antigravity(props) {
  const {
    count,
    magnetRadius,
    ringRadius,
    waveSpeed,
    waveAmplitude,
    particleSize,
    lerpSpeed,
    color,
    autoAnimate,
    particleVariance,
    rotationSpeed,
    depthFactor,
    pulseSpeed,
    particleShape,
    fieldStrength,
  } = {
    ...DEFAULTS,
    ...props,
  }

  const frameRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current

    if (!frame || !canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return undefined
    }

    const pointer = {
      x: 0,
      y: 0,
      active: false,
    }

    let animationFrameId = 0
    let particles = []
    let width = 0
    let height = 0
    let devicePixelRatio = window.devicePixelRatio || 1

    const rgb = hexToRgb(color)

    const resize = () => {
      width = frame.clientWidth
      height = frame.clientHeight
      devicePixelRatio = window.devicePixelRatio || 1

      canvas.width = Math.round(width * devicePixelRatio)
      canvas.height = Math.round(height * devicePixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      particles = createParticles({
        count,
        width,
        height,
        particleVariance,
        depthFactor,
      })
    }

    const handlePointerMove = (event) => {
      const bounds = frame.getBoundingClientRect()
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top
      pointer.active = true
    }

    const handlePointerLeave = () => {
      pointer.active = false
    }

    const render = (timestamp) => {
      const time = timestamp * 0.001
      const centerX = width * 0.5
      const centerY = height * 0.5
      const activeX = pointer.active ? pointer.x : centerX
      const activeY = pointer.active ? pointer.y : centerY
      const pulse = 1 + Math.sin(time * pulseSpeed) * 0.08
      const magnetRadiusPx = magnetRadius * 18
      const ringRadiusPx = ringRadius * 18 * pulse
      const ringWidth = magnetRadius * 7

      context.clearRect(0, 0, width, height)
      context.lineCap = 'round'

      for (const particle of particles) {
        const baseWaveX =
          Math.sin(
            particle.baseY * 0.016 +
              particle.seed * 6 +
              time * waveSpeed * (autoAnimate ? 2.2 : 1.4),
          ) *
          waveAmplitude *
          18 *
          particle.depth

        const baseWaveY =
          Math.cos(
            particle.baseX * 0.012 -
              particle.seed * 5 +
              time * waveSpeed * (autoAnimate ? 1.8 : 1.1),
          ) *
          waveAmplitude *
          12 *
          (1.15 - particle.depth * 0.2)

        const rotation =
          rotationSpeed === 0
            ? 0
            : Math.sin(time * (rotationSpeed + 0.2) + particle.seed * 8) *
              rotationSpeed *
              24

        let targetX = particle.baseX + baseWaveX + rotation
        let targetY = particle.baseY + baseWaveY

        const deltaX = targetX - activeX
        const deltaY = targetY - activeY
        const distance = Math.hypot(deltaX, deltaY) || 1
        const directionX = deltaX / distance
        const directionY = deltaY / distance

        const repelFactor = Math.max(0, 1 - distance / magnetRadiusPx)
        const repelForce = repelFactor * repelFactor * fieldStrength * 10

        targetX += directionX * repelForce
        targetY += directionY * repelForce

        const ringDistance = Math.abs(distance - ringRadiusPx)
        const ringFactor = Math.max(0, 1 - ringDistance / ringWidth)

        targetX += directionX * ringFactor * waveAmplitude * 18
        targetY += directionY * ringFactor * waveAmplitude * 18

        particle.x += (targetX - particle.x) * lerpSpeed
        particle.y += (targetY - particle.y) * lerpSpeed

        const velocityX = particle.x - particle.prevX
        const velocityY = particle.y - particle.prevY
        const angle = Math.atan2(velocityY || 0.001, velocityX || 0.001)
        const alpha = 0.12 + particle.depth * 0.34
        const length =
          particleShape === 'capsule'
            ? (particleSize * 4.8 + particle.jitter * 2.4) * particle.depth
            : particleSize * 2.1 * particle.depth
        const halfLength = length * 0.5

        context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
        context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
        context.lineWidth = Math.max(1, particleSize * particle.depth)

        if (particleShape === 'capsule') {
          context.beginPath()
          context.moveTo(
            particle.x - Math.cos(angle) * halfLength,
            particle.y - Math.sin(angle) * halfLength,
          )
          context.lineTo(
            particle.x + Math.cos(angle) * halfLength,
            particle.y + Math.sin(angle) * halfLength,
          )
          context.stroke()
        } else {
          context.beginPath()
          context.arc(
            particle.x,
            particle.y,
            Math.max(1, particleSize * 0.9 * particle.depth),
            0,
            Math.PI * 2,
          )
          context.fill()
        }

        particle.prevX = particle.x
        particle.prevY = particle.y
      }

      animationFrameId = window.requestAnimationFrame(render)
    }

    resize()
    animationFrameId = window.requestAnimationFrame(render)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(frame)

    frame.addEventListener('pointermove', handlePointerMove)
    frame.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      frame.removeEventListener('pointermove', handlePointerMove)
      frame.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [
    autoAnimate,
    color,
    count,
    depthFactor,
    fieldStrength,
    lerpSpeed,
    magnetRadius,
    particleShape,
    particleSize,
    particleVariance,
    pulseSpeed,
    ringRadius,
    rotationSpeed,
    waveAmplitude,
    waveSpeed,
  ])

  return (
    <div ref={frameRef} className="antigravity-frame">
      <canvas ref={canvasRef} className="antigravity-canvas" />
    </div>
  )
}

function createParticles({ count, width, height, particleVariance, depthFactor }) {
  const particles = []
  const paddingX = width * 0.08
  const paddingY = height * 0.08
  const columns = Math.max(12, Math.round(Math.sqrt(count * (width / height))))
  const rows = Math.max(12, Math.round(count / columns))
  const spacingX = (width - paddingX * 2) / columns
  const spacingY = (height - paddingY * 2) / rows

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (particles.length >= count) {
        return particles
      }

      const varianceX = (Math.random() - 0.5) * spacingX * 0.45 * particleVariance
      const varianceY = (Math.random() - 0.5) * spacingY * 0.45 * particleVariance
      const baseX = paddingX + column * spacingX + spacingX * 0.5 + varianceX
      const baseY = paddingY + row * spacingY + spacingY * 0.5 + varianceY
      const depth = 0.7 + Math.random() * Math.max(0.25, depthFactor)

      particles.push({
        baseX,
        baseY,
        x: baseX,
        y: baseY,
        prevX: baseX,
        prevY: baseY,
        depth,
        jitter: Math.random(),
        seed: Math.random(),
      })
    }
  }

  return particles
}

function hexToRgb(value) {
  const normalized = value.replace('#', '')

  if (normalized.length !== 6) {
    return { r: 17, g: 17, b: 17 }
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}
