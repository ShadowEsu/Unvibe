import { useEffect, useState } from 'react';

const VERBS = ['Thinking', 'Reading', 'Scrutinizing', 'Weighing', 'Compacting', 'Checking'] as const;
const SPARKS = ['·', '✢', '✶', '✻'] as const;

export function ThinkingStatus({ label = 'Unvibe' }: { label?: string }) {
  const [verbIndex, setVerbIndex] = useState(0);
  const [sparkIndex, setSparkIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const verbs = window.setInterval(() => {
      setVerbIndex((index) => (index + 1) % VERBS.length);
    }, 2000);
    const sparks = window.setInterval(() => {
      setSparkIndex((index) => (index + 1) % SPARKS.length);
    }, 160);
    return () => {
      window.clearInterval(verbs);
      window.clearInterval(sparks);
    };
  }, [reduced]);

  const verb = reduced ? 'Thinking' : VERBS[verbIndex];
  return (
    <div className="think-status" role="status" aria-live="polite">
      <span className="think-status__spark" aria-hidden="true">{SPARKS[sparkIndex]}</span>
      <span className="think-status__copy">
        <span className="think-status__verb" key={verb}>{verb}</span>
        <span className="think-status__sub">{label} is working</span>
      </span>
    </div>
  );
}
