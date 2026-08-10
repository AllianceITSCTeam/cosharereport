import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders children', () => {
    render(<FilterBar><span>field</span></FilterBar>);
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('shows active count badge when activeCount > 0', () => {
    render(<FilterBar activeCount={3}><span /></FilterBar>);
    expect(screen.getByText('3 active')).toBeInTheDocument();
  });

  it('hides badge when activeCount is 0', () => {
    render(<FilterBar activeCount={0}><span /></FilterBar>);
    expect(screen.queryByText(/active/)).toBeNull();
  });

  it('hides badge when activeCount is undefined', () => {
    render(<FilterBar><span /></FilterBar>);
    expect(screen.queryByText(/active/)).toBeNull();
  });

  it('renders collapse toggle when collapsible=true', () => {
    render(<FilterBar collapsible><span>field</span></FilterBar>);
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });

  it('collapses and hides children on toggle', async () => {
    render(<FilterBar collapsible><span>field</span></FilterBar>);
    await userEvent.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.queryByText('field')).toBeNull();
  });

  it('renders already collapsed when defaultCollapsed=true', () => {
    render(<FilterBar collapsible defaultCollapsed><span>field</span></FilterBar>);
    expect(screen.queryByText('field')).toBeNull();
  });

  it('forwards testId', () => {
    render(<FilterBar testId="my-bar"><span /></FilterBar>);
    expect(screen.getByTestId('my-bar')).toBeInTheDocument();
  });
});
