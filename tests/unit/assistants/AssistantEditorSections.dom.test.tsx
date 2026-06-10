import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from '@arco-design/web-react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AssistantEditorSections from '@/renderer/pages/settings/AssistantSettings/AssistantEditorSections';

const mockUseModelProviderList = vi.fn(() => ({
  providers: [],
  getAvailableModels: () => [],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; count?: number }) => {
      if (options?.defaultValue) return options.defaultValue.replace('{{count}}', String(options.count ?? ''));
      return _key;
    },
  }),
}));

vi.mock('@/renderer/hooks/agent/useModelProviderList', () => ({
  useModelProviderList: () => mockUseModelProviderList(),
}));

vi.mock('@/renderer/components/chat/EmojiPicker', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <ConfigProvider>{ui}</ConfigProvider>
    </MemoryRouter>
  );

describe('AssistantEditorSections', () => {
  beforeEach(() => {
    mockUseModelProviderList.mockReturnValue({
      providers: [],
      getAvailableModels: () => [],
    });
  });

  it('renders all default configuration rows in a single card', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText={'Prompt one\nPrompt two'}
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[]}
        selectedMcpIds={['filesystem']}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
        setEditContext={vi.fn()}
        promptViewMode='preview'
        setPromptViewMode={vi.fn()}
        availableSkills={[
          { name: 'browse', description: 'Browse the web', location: '', is_custom: false, source: 'builtin' },
        ]}
        selectedSkills={['browse']}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    const defaultsCard = screen.getByTestId('assistant-card-defaults');
    const defaultsScope = within(defaultsCard);
    expect(defaultsScope.getByText('Default Model')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default Permission')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default Skills')).toBeInTheDocument();
    expect(defaultsScope.getByText('Default MCP')).toBeInTheDocument();
    expect(
      defaultsScope.getByText(
        'Not configured applies no assistant-level default. Remember last used only takes effect after this assistant has recorded a previous selection.'
      )
    ).toBeInTheDocument();
  });

  it('renders recommended prompts as a list with actions', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText={'Prompt one\nPrompt two'}
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[]}
        selectedMcpIds={[]}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
        setEditContext={vi.fn()}
        promptViewMode='preview'
        setPromptViewMode={vi.fn()}
        availableSkills={[]}
        selectedSkills={[]}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    const promptCard = screen.getByTestId('assistant-card-prompts');
    const promptScope = within(promptCard);
    expect(promptScope.getByText('Prompt one')).toBeInTheDocument();
    expect(promptScope.getByText('Prompt two')).toBeInTheDocument();
    expect(promptScope.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('keeps builtin default model and permission editable while showing prompts as read-only content', () => {
    const { container } = renderWithProviders(
      <AssistantEditorSections
        isCreating={false}
        editName='Cowork'
        setEditName={vi.fn()}
        editDescription='Builtin desc'
        setEditDescription={vi.fn()}
        editAvatar='🤝'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText={'Prompt one\nPrompt two'}
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='fixed'
        setDefaultModelMode={vi.fn()}
        defaultModelValue='gemini-2.5-pro'
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='fixed'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue='default'
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[{ id: 'mcp-a', name: 'Server A', enabled: true } as any]}
        selectedMcpIds={['mcp-a']}
        setSelectedMcpIds={vi.fn()}
        editContext='builtin rules'
        setEditContext={vi.fn()}
        promptViewMode='preview'
        setPromptViewMode={vi.fn()}
        availableSkills={[
          { name: 'browse', description: 'Browse the web', location: '', is_custom: false, source: 'builtin' },
        ]}
        selectedSkills={['browse']}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={{
          id: 'cowork',
          name: 'Cowork',
          sort_order: 1,
          source: 'builtin',
          enabled: true,
          preset_agent_type: 'claude',
        }}
        isExtensionAssistant={() => false}
        availableBackends={[{ id: 'claude', name: 'Claude', isExtension: false, modelOptions: [] }]}
        handleDuplicate={vi.fn()}
      />
    );

    const defaultsCard = screen.getByTestId('assistant-card-defaults');
    expect(within(defaultsCard).getByText('Default Model')).toBeInTheDocument();
    expect(within(defaultsCard).getByText('Default Permission')).toBeInTheDocument();

    const modelSelect = container.querySelector('[data-testid="select-assistant-default-model"]');
    const permissionSelect = container.querySelector('[data-testid="select-assistant-default-permission"]');
    expect(modelSelect?.className).not.toContain('arco-select-disabled');
    expect(permissionSelect?.className).not.toContain('arco-select-disabled');
    expect(screen.queryByTestId('select-assistant-default-skills')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-assistant-default-mcp')).not.toBeInTheDocument();
    expect(screen.getByText('browse')).toBeInTheDocument();
    expect(screen.getByText('Server A')).toBeInTheDocument();

    const promptCard = screen.getByTestId('assistant-card-prompts');
    const promptScope = within(promptCard);
    expect(promptScope.getByText('Prompt one')).toBeInTheDocument();
    expect(promptScope.getByText('Prompt two')).toBeInTheDocument();
    expect(promptScope.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('renders single default-skill and default-mcp controls with hub links', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText=''
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='fixed'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='fixed'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[{ id: 'mcp-a', name: 'Server A', enabled: true } as any]}
        selectedMcpIds={['mcp-a']}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
        setEditContext={vi.fn()}
        promptViewMode='preview'
        setPromptViewMode={vi.fn()}
        availableSkills={[
          { name: 'browse', description: 'Browse the web', location: '', is_custom: false, source: 'builtin' },
        ]}
        selectedSkills={['browse']}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    expect(screen.queryByTestId('select-assistant-default-skills-mode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-assistant-default-mcp-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-open-skills-settings')).toBeInTheDocument();
    expect(screen.getByTestId('btn-open-mcp-settings')).toBeInTheDocument();
  });

  it('does not autofocus the rules textarea when edit mode is visible', () => {
    renderWithProviders(
      <AssistantEditorSections
        isCreating={true}
        editName='Writer'
        setEditName={vi.fn()}
        editDescription='desc'
        setEditDescription={vi.fn()}
        editAvatar='✍️'
        setEditAvatar={vi.fn()}
        editAgent='claude'
        setEditAgent={vi.fn()}
        editRecommendedPromptsText=''
        setEditRecommendedPromptsText={vi.fn()}
        defaultModelMode='auto'
        setDefaultModelMode={vi.fn()}
        defaultModelValue=''
        setDefaultModelValue={vi.fn()}
        defaultPermissionMode='auto'
        setDefaultPermissionMode={vi.fn()}
        defaultPermissionValue=''
        setDefaultPermissionValue={vi.fn()}
        defaultSkillsMode='auto'
        setDefaultSkillsMode={vi.fn()}
        defaultMcpMode='auto'
        setDefaultMcpMode={vi.fn()}
        availableMcpServers={[]}
        selectedMcpIds={[]}
        setSelectedMcpIds={vi.fn()}
        editContext='rules'
        setEditContext={vi.fn()}
        promptViewMode='edit'
        setPromptViewMode={vi.fn()}
        availableSkills={[]}
        selectedSkills={[]}
        setSelectedSkills={vi.fn()}
        pendingSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        builtinAutoSkills={[]}
        disabledBuiltinSkills={[]}
        setDisabledBuiltinSkills={vi.fn()}
        activeAssistant={null}
        isExtensionAssistant={() => false}
        availableBackends={[]}
        handleDuplicate={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText('Enter rules in Markdown format...');
    expect(document.activeElement).not.toBe(textarea);
  });
});
