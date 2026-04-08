import './ShinyText.css'

function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}) {
  const animationDirection = yoyo
    ? direction === 'left'
      ? 'alternate'
      : 'alternate-reverse'
    : direction === 'left'
      ? 'normal'
      : 'reverse'

  const style = disabled
    ? {
        color,
      }
    : {
        '--shiny-color': color,
        '--shiny-shine': shineColor,
        '--shiny-spread': `${spread}deg`,
        '--shiny-duration': `${speed}s`,
        '--shiny-delay': `${delay}s`,
        '--shiny-direction': animationDirection,
      }

  return (
    <span
      className={[
        'shiny-text',
        disabled ? 'is-disabled' : '',
        pauseOnHover ? 'pause-on-hover' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {text}
    </span>
  )
}

export default ShinyText
