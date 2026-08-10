import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useCommittedFilter } from './useCommittedFilter';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

const DEFAULT = { search: '', action: '' };

describe('useCommittedFilter', () => {
  it('initialises draft and committed to defaultValue', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    expect(result.current.draft).toEqual(DEFAULT);
    expect(result.current.committed).toEqual(DEFAULT);
  });

  it('setDraft updates draft but not committed', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    act(() => result.current.setDraft({ search: 'hello' }));
    expect(result.current.draft.search).toBe('hello');
    expect(result.current.committed.search).toBe('');
  });

  it('commit promotes draft to committed', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    act(() => result.current.setDraft({ search: 'hello' }));
    act(() => result.current.commit());
    expect(result.current.committed.search).toBe('hello');
  });

  it('isDirty is true when draft differs from committed', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    act(() => result.current.setDraft({ search: 'x' }));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty is false after commit', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    act(() => result.current.setDraft({ search: 'x' }));
    act(() => result.current.commit());
    expect(result.current.isDirty).toBe(false);
  });

  it('draft boots from localStorage-restored committed value', () => {
    const savedFilter = { search: 'admin', action: 'CREATE' };
    localStorage.setItem('vibe365-test-ls', JSON.stringify(savedFilter));
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'vibe365-test-ls', defaultValue: DEFAULT, mode: 'localStorage' }),
      { wrapper },
    );
    // draft and committed should both reflect the persisted value
    expect(result.current.draft).toEqual(savedFilter);
    expect(result.current.committed).toEqual(savedFilter);
    localStorage.removeItem('vibe365-test-ls');
  });

  it('reset restores both draft and committed to default', () => {
    const { result } = renderHook(
      () => useCommittedFilter({ key: 'test', defaultValue: DEFAULT }),
      { wrapper },
    );
    act(() => result.current.setDraft({ search: 'x' }));
    act(() => result.current.commit());
    act(() => result.current.reset());
    expect(result.current.draft).toEqual(DEFAULT);
    expect(result.current.committed).toEqual(DEFAULT);
  });
});
