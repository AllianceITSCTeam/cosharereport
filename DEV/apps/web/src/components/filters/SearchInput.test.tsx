import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Find staff" />);
    expect(screen.getByPlaceholderText('Find staff')).toBeInTheDocument();
  });

  it('calls onChange immediately when debounceMs=0', async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} debounceMs={0} />);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('calls onEnter when Enter key pressed', async () => {
    const onEnter = vi.fn();
    render(<SearchInput value="" onChange={() => {}} onEnter={onEnter} />);
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('syncs external value change into local state', async () => {
    const { rerender } = render(<SearchInput value="initial" onChange={() => {}} />);
    rerender(<SearchInput value="reset" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('reset');
  });

  it('forwards testId to input', () => {
    render(<SearchInput value="" onChange={() => {}} testId="my-search" />);
    expect(screen.getByTestId('my-search')).toBeInTheDocument();
  });
});
