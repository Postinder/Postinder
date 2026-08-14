import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectReviewPanel } from './ClientPortalPage'
import SoundtrackReviewCard from './SoundtrackReviewCard'

vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({ isDark: false, toggle: vi.fn() }),
}))

afterEach(() => cleanup())

function emailProject(revision, extra = {}) {
  return {
    id: 'post-1',
    title: 'Campanha de agosto',
    status: 'sent',
    channels: ['E-mail Marketing'],
    emailLink: 'https://example.test/preview',
    contentRevision: revision,
    files: [],
    ...extra,
  }
}

function reviewProps(project, overrides = {}) {
  return {
    projects: [project],
    pendingItemsCount: 1,
    selectedProjectId: project.id,
    onSelectProject: vi.fn(),
    onSaveItemDecision: vi.fn(() => Promise.resolve(true)),
    onCompleteItemReview: vi.fn(),
    onApprovePost: vi.fn(),
    onRejectPost: vi.fn(() => Promise.resolve(true)),
    onApproveSoundtrack: vi.fn(),
    onAdjustSoundtrack: vi.fn(() => Promise.resolve(true)),
    onUndo: vi.fn(),
    canUndoLastAction: false,
    showPostList: false,
    sequentialApproval: true,
    soundtrackEnabled: false,
    approvalMode: 'content',
    busy: false,
    revisionConflictSequence: 0,
    ...overrides,
  }
}

describe('portal revision-bound interactive intents', () => {
  it('closes and clears an old rejection dialog after a revision conflict', async () => {
    const oldProject = emailProject(4)
    const props = reviewProps(oldProject)
    const view = render(<ProjectReviewPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ajuste' }))
    const oldDialog = screen.getByRole('dialog')
    fireEvent.change(within(oldDialog).getByRole('textbox'), { target: { value: 'Intencao da revisao 4' } })

    const newProject = emailProject(5)
    view.rerender(<ProjectReviewPanel {...reviewProps(newProject, {
      onRejectPost: props.onRejectPost,
      revisionConflictSequence: 1,
    })} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ajuste' }))
    const newDialog = screen.getByRole('dialog')
    const textarea = within(newDialog).getByRole('textbox')
    expect(textarea.value).toBe('')
    fireEvent.change(textarea, { target: { value: 'Nova intencao explicita' } })
    fireEvent.click(within(newDialog).getByRole('button', { name: 'Solicitar ajuste' }))

    await waitFor(() => expect(props.onRejectPost).toHaveBeenCalledWith(
      'post-1',
      'Nova intencao explicita',
      [],
      5,
    ))
  })

  it('binds soundtrack adjustment to its opening revision and invalidates it on conflict', async () => {
    const onAdjust = vi.fn(() => Promise.resolve(true))
    const soundtrack = {
      id: 'soundtrack-1',
      mode: 'external_reference',
      externalUrl: 'https://example.test/audio',
      trackName: 'Referencia',
      approvalStatus: 'pending',
    }
    const view = render(
      <SoundtrackReviewCard
        post={{ id: 'post-1', contentRevision: 7, files: [] }}
        soundtrack={soundtrack}
        onApprove={vi.fn()}
        onAdjust={onAdjust}
        busy={false}
        revisionConflictSequence={0}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ajuste da revisao 7' } })
    view.rerender(
      <SoundtrackReviewCard
        post={{ id: 'post-1', contentRevision: 8, files: [] }}
        soundtrack={soundtrack}
        onApprove={vi.fn()}
        onAdjust={onAdjust}
        busy={false}
        revisionConflictSequence={1}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }))
    expect(screen.getByRole('textbox').value).toBe('')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ajuste novo' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reprovar' }))
    await waitFor(() => expect(onAdjust).toHaveBeenCalledWith('Ajuste novo', 8))
  })

  it('offers three explicit content intents and maps Adorei to an approved positive reaction', () => {
    const project = emailProject(6)
    const props = reviewProps(project)
    render(<ProjectReviewPanel {...props} />)

    expect(screen.getByRole('button', { name: 'Adorei' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Solicitar ajuste' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Adorei' }))
    expect(props.onApprovePost).toHaveBeenCalledWith('post-1', 'loved')
  })

  it('keeps a loved item visibly distinct while preserving approved as its operational decision', () => {
    const project = {
      ...emailProject(3),
      channels: ['Instagram'],
      emailLink: null,
      files: [{
        id: 'file-1',
        name: 'arte.png',
        file_type: 'IMAGE',
        url: 'https://example.test/arte.png',
        review_decision: 'approved',
        review_positive_reaction: 'loved',
      }],
    }
    render(<ProjectReviewPanel {...reviewProps(project, { approvalMode: 'item' })} />)

    expect(screen.getAllByRole('button', { name: 'Adorei' }).some(button => button.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Aprovar' }).every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('renders a non-empty revision-visible funnel in simplified and detailed modes only', () => {
    const visible = emailProject(2, { funnelTag: 'Meio' })
    const view = render(<ProjectReviewPanel {...reviewProps(visible)} />)
    expect(screen.getByText('Funil: Meio')).toBeTruthy()

    view.rerender(<ProjectReviewPanel {...reviewProps(visible, {
      showPostList: true,
      sequentialApproval: false,
    })} />)
    expect(screen.getByText('Funil: Meio')).toBeTruthy()

    view.rerender(<ProjectReviewPanel {...reviewProps(emailProject(2), {
      showPostList: true,
      sequentialApproval: false,
    })} />)
    expect(screen.queryByText(/^Funil:/)).toBeNull()
  })
})
