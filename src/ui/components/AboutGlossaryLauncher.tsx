import { lazy, Suspense, useState } from 'react';
import { Modal } from './Modal';

const AboutGlossaryContent = lazy(async () => {
  const module = await import('./AboutGlossaryContent');
  return { default: module.AboutGlossaryContent };
});

export function AboutGlossaryLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button button--ghost hero__about-button" onClick={() => setOpen(true)}>
        Open About
      </button>
      <Modal open={open} title="Concept Primer / Glossary" placement="top" onClose={() => setOpen(false)}>
        <Suspense fallback={<div className="stack muted">Loading glossary…</div>}>
          <AboutGlossaryContent />
        </Suspense>
      </Modal>
    </>
  );
}
