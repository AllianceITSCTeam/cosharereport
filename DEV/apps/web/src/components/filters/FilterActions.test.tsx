import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FilterActions } from './FilterActions';

describe('FilterActions', () => {
  it('renders nothing when no handlers provided', () => {
    const { container } = render(<FilterActions />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Search button and fires onSearch', async () => {
    const onSearch = vi.fn();
    render(<FilterActions onSearch={onSearch} />);
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('renders Reset button and fires onReset', async () => {
    const onReset = vi.fn();
    render(<FilterActions onReset={onReset} />);
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders Export button and fires onExport', async () => {
    const onExport = vi.fn();
    render(<FilterActions onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('disables Search while isSearching', () => {
    render(<FilterActions onSearch={() => {}} isSearching />);
    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();
  });

  it('disables Export while isExporting', () => {
    render(<FilterActions onExport={() => {}} isExporting />);
    expect(screen.getByRole('button', { name: /exporting/i })).toBeDisabled();
  });

  it('applies testIdPrefix to buttons', () => {
    render(<FilterActions onSearch={() => {}} onReset={() => {}} testIdPrefix="audit-log" />);
    expect(screen.getByTestId('audit-log-search')).toBeInTheDocument();
    expect(screen.getByTestId('audit-log-reset')).toBeInTheDocument();
  });

  it('renders custom labels', () => {
    render(<FilterActions onSearch={() => {}} searchLabel="Apply" />);
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });
});
