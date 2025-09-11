import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

// Mock the useAuth hook
vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/AuthProvider';

describe('Navbar', () => {
  it('renders unauthenticated navbar with login button', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false });
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>
    );

    expect(getByText('Amico Segreto')).toBeInTheDocument();
    expect(getByText('Accedi')).toBeInTheDocument();
  });

  it('does not render on /auth route', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, loading: false });
    const { queryByText } = render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Navbar />
      </MemoryRouter>
    );

    expect(queryByText('Amico Segreto')).not.toBeInTheDocument();
  });

  it('renders authenticated navbar with navigation links', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 'u1' }, loading: false });
    const { getByText, getAllByText, queryByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>
    );

    expect(getByText('Amico Segreto')).toBeInTheDocument();
    expect(getAllByText('Eventi').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Idee').length).toBeGreaterThanOrEqual(1);
    // Login button should not be present
    expect(queryByText('Accedi')).not.toBeInTheDocument();
  });
});