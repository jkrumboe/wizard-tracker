import { useState } from 'react';
import { BombIcon, CloudIcon } from '@/components/ui/Icon';
import '@/styles/components/special-card-toggle.css';

const polar = (deg, dist) => {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(Math.cos(rad) * dist), y: Math.round(Math.sin(rad) * dist) };
};

// Static particle layouts so every burst looks the same and nothing re-randomizes on render
const BOMB_SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = i * 45 + (i % 2 ? 12 : -8);
  return { angle, dist: 38 + (i % 3) * 8, delay: (i % 3) * 20 };
});

const BOMB_EMBERS = Array.from({ length: 6 }, (_, i) => {
  const { x, y } = polar(i * 60 + 30, 30 + (i % 2) * 10);
  return { x, y, size: 3 + (i % 2), delay: 80 + i * 20 };
});

const BOMB_SMOKE = [
  { x: -16, y: -6, size: 16, delay: 160 },
  { x: 14, y: -10, size: 20, delay: 200 },
  { x: 0, y: -14, size: 18, delay: 240 },
];

const CLOUD_PUFFS = [
  { x: -52, y: -6, size: 30, delay: 0 },
  { x: 52, y: -8, size: 32, delay: 40 },
  { x: -24, y: -26, size: 26, delay: 100 },
  { x: 24, y: -28, size: 28, delay: 130 },
  { x: -58, y: 14, size: 20, delay: 170 },
  { x: 58, y: 12, size: 22, delay: 190 },
];

const CLOUD_MIST = Array.from({ length: 4 }, (_, i) => {
  const { x, y } = polar(i * 90 + 45, 42);
  return { x, y, delay: 250 + i * 40 };
});

const px = (value) => `${value}px`;

function BombBurst() {
  return (
    <>
      <span className="sct-fireball" />
      <span className="sct-shockwave" />
      {BOMB_SPARKS.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="sct-spark"
          style={{ '--angle': `${s.angle}deg`, '--dist': px(s.dist), animationDelay: `${s.delay}ms` }}
        />
      ))}
      {BOMB_EMBERS.map((e, i) => (
        <span
          key={`ember-${i}`}
          className="sct-ember"
          style={{ '--x': px(e.x), '--y': px(e.y), '--size': px(e.size), animationDelay: `${e.delay}ms` }}
        />
      ))}
      {BOMB_SMOKE.map((s, i) => (
        <span
          key={`smoke-${i}`}
          className="sct-smoke"
          style={{ '--x': px(s.x), '--y': px(s.y), '--size': px(s.size), animationDelay: `${s.delay}ms` }}
        />
      ))}
    </>
  );
}

function CloudBurst() {
  return (
    <>
      <span className="sct-haze" />
      <span className="sct-rainbow" />
      {CLOUD_PUFFS.map((p, i) => (
        <span
          key={`puff-${i}`}
          className="sct-puff"
          style={{ '--x': px(p.x), '--y': px(p.y), '--size': px(p.size), animationDelay: `${p.delay}ms` }}
        />
      ))}
      {CLOUD_MIST.map((m, i) => (
        <span
          key={`mist-${i}`}
          className="sct-mist"
          style={{ '--x': px(m.x), '--y': px(m.y), animationDelay: `${m.delay}ms` }}
        />
      ))}
    </>
  );
}

const VARIANTS = {
  bomb: { Icon: BombIcon, Burst: BombBurst },
  cloud: { Icon: CloudIcon, Burst: CloudBurst },
};

/**
 * Toggle chip for Wizard special cards (Bombe / Wolke) with a one-shot
 * particle effect each time it is switched on.
 * @param {{ variant: 'bomb' | 'cloud', active: boolean, label: string, onToggle: (next: boolean) => void }} props
 */
const SpecialCardToggle = ({ variant, active, label, onToggle }) => {
  const [burstId, setBurstId] = useState(0);
  const { Icon, Burst } = VARIANTS[variant];

  const handleClick = () => {
    if (!active) setBurstId((id) => id + 1);
    onToggle(!active);
  };

  return (
    <button
      type="button"
      className={`special-card-toggle ${variant}${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={handleClick}
    >
      <span className="sct-icon">
        <Icon size={18} />
      </span>
      <span className="sct-label">{label}</span>
      {active && burstId > 0 && (
        <span key={burstId} className="sct-fx" aria-hidden="true">
          <Burst />
        </span>
      )}
    </button>
  );
};

export default SpecialCardToggle;
