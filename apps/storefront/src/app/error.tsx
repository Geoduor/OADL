'use client';

import { copy } from '../lib/copy';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <h1>{copy.somethingWrong}</h1>
      <button type="button" className="primary" onClick={reset}>
        Try again
      </button>
    </>
  );
}
