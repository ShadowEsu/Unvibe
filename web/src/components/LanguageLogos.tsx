'use client';

const LANGUAGES = [
  { name: 'TypeScript', color: '#3178C6', icon: 'TS' },
  { name: 'JavaScript', color: '#F7DF1E', icon: 'JS' },
  { name: 'Python', color: '#3776AB', icon: 'Py' },
  { name: 'React', color: '#61DAFB', icon: '⚛' },
  { name: 'Go', color: '#00ADD8', icon: 'Go' },
  { name: 'Rust', color: '#DEA584', icon: '⚙' },
  { name: 'CSS', color: '#1572B6', icon: '#' },
  { name: 'HTML', color: '#E34F26', icon: '</>' },
  { name: 'PHP', color: '#777BB4', icon: 'PHP' },
  { name: 'Ruby', color: '#CC342D', icon: '◆' },
  { name: 'SQL', color: '#336791', icon: '≣' },
  { name: 'Swift', color: '#F05138', icon: 'Swift' },
  { name: 'C', color: '#A8B9CC', icon: 'C' },
  { name: 'C++', color: '#00599C', icon: 'C++' },
  { name: 'Java', color: '#ED8B00', icon: 'Jv' },
];

function LogoBadge({ name, color, icon }: { name: string; color: string; icon: string }) {
  return (
    <div className="lang-logo" title={name}>
      <span className="lang-logo__icon" style={{ background: color, color: /FF|F7|CC|DD/.test(color) ? '#111' : '#fff' }}>
        {icon}
      </span>
      <span className="lang-logo__name">{name}</span>
    </div>
  );
}

export function LanguageLogos() {
  return (
    <div className="lang-marquee" aria-label="Languages and tools Unvibe supports">
      <div className="lang-marquee__track">
        {[...LANGUAGES, ...LANGUAGES].map((lang, i) => (
          <LogoBadge key={`${lang.name}-${i}`} {...lang} />
        ))}
      </div>
    </div>
  );
}
