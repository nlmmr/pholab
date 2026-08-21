import React, { Suspense, useState } from 'react';
import { IPHO_2024_E2_DEFINITION } from './experiments/ipho-2024-e2/definition';

const IPhO2024E2Lab = React.lazy(() =>
  import('./experiments/ipho-2024-e2/components/IPhO2024E2Lab').then((module) => ({ default: module.IPhO2024E2Lab })),
);

const FUTURE_AREAS = [
  { name: 'Mechanics', glyph: '↙' },
  { name: 'Electricity', glyph: '⌁' },
  { name: 'Thermodynamics', glyph: '∿' },
];

const Home: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="home-shell">
    <header className="home-nav">
      <a className="home-brand" href="#top"><span className="brand-mark">Φ</span><strong>PhOLab</strong></a>
      <span className="home-nav-note">Real experimental practice, in your browser.</span>
    </header>

    <main id="top" className="home-main">
      <section className="hero-section">
        <span className="eyebrow">Experimental physics · hands on</span>
        <h1>Train for the experiment,<br /><em>not the interface.</em></h1>
        <p>Practice the same observation, alignment, and measurement decisions demanded by international physics olympiads.</p>
      </section>

      <section className="catalog-section" aria-labelledby="available-title">
        <div className="section-heading"><div><span className="eyebrow">Experiment library</span><h2 id="available-title">Available now</h2></div><span className="catalog-count">01 experiment</span></div>

        <article className="featured-experiment">
          <div className="experiment-copy">
            <div className="experiment-labels"><span>IPhO 2024</span><span>Optics</span><span>Experimental</span></div>
            <h3>{IPHO_2024_E2_DEFINITION.title}</h3>
            <p>{IPHO_2024_E2_DEFINITION.description}</p>
            <div className="experiment-meta"><div><small>Competition time</small><strong>5 hours</strong></div><div><small>MVP scope</small><strong>Part A complete</strong></div><div><small>Mode</small><strong>IPhO Original</strong></div></div>
            <button className="start-button" onClick={onStart}><span>Start experiment</span><i>→</i></button>
          </div>
          <div className="apparatus-preview" aria-label="Illustration of the phase-step diffraction apparatus">
            <div className="preview-glow" />
            <div className="preview-screen"><i /></div>
            <div className="preview-bench">
              <div className="preview-platform"><span className="preview-dial" /><span className="preview-holder" /><span className="preview-laser" /><span className="preview-lens" /><i className="preview-beam" /></div>
              <div className="preview-board"><i /><i /><span /></div>
              <div className="preview-power" />
            </div>
            <span className="preview-caption">IPhO 2024 E2 apparatus · Part A</span>
          </div>
        </article>
      </section>

      <section className="future-section">
        <div className="section-heading"><div><span className="eyebrow">The lab expands next</span><h2>More areas</h2></div></div>
        <div className="future-grid">{FUTURE_AREAS.map((area) => <div className="future-card" key={area.name}><span>{area.glyph}</span><strong>{area.name}</strong><small>Planned</small></div>)}</div>
      </section>
    </main>
    <footer className="home-footer"><strong>PhOLab</strong><span>Built around official olympiad experiments.</span></footer>
  </div>
);

export const App: React.FC = () => {
  const [screen, setScreen] = useState<'home' | 'experiment'>('home');
  return screen === 'home' ? <Home onStart={() => setScreen('experiment')} /> : (
    <Suspense fallback={<div className="lab-loading"><span className="brand-mark">Φ</span><strong>Preparing the optics bench…</strong></div>}>
      <IPhO2024E2Lab onExit={() => setScreen('home')} />
    </Suspense>
  );
};
