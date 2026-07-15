import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('boom');
  return <p>fine</p>;
}

// "Disarm" lives outside the boundary so it survives the crash — this is
// what lets Reload actually recover once the underlying cause is gone,
// rather than just re-throwing the same still-broken subtree.
function BombHost() {
  const [armed, setArmed] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setArmed(false)}>
        Disarm
      </button>
      <ErrorBoundary label="Test topic">
        <Bomb armed={armed} />
      </ErrorBoundary>
    </div>
  );
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary label="Test topic">
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('catches a render throw and shows the fallback instead of propagating', () => {
    // React logs the caught error to console.error by default; silence it for this test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary label="Test topic">
        <Bomb armed />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Test topic hit an error')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Test topic' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('reload remounts the subtree, recovering once the underlying cause is fixed', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<BombHost />);

    expect(screen.getByText('Test topic hit an error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Disarm' }));
    // Fallback is still showing — the crashed subtree isn't re-rendered on its own.
    expect(screen.getByText('Test topic hit an error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reload Test topic' }));
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByText('Test topic hit an error')).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
