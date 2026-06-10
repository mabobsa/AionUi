import type { AssistantListItem, BuiltinAutoSkill, SkillInfo } from './types';
import type { IMcpServer } from '@/common/config/storage';
import type { AvailableBackend } from '@/renderer/hooks/assistant';
import { useModelProviderList } from '@/renderer/hooks/agent/useModelProviderList';
import EmojiPicker from '@/renderer/components/chat/EmojiPicker';
import MarkdownView from '@/renderer/components/Markdown';
import { getAgentModes } from '@/renderer/utils/model/agentModes';
import { Avatar, Button, Input, Select, Tag } from '@arco-design/web-react';
import { Info, Robot } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export type AssistantEditorSectionsProps = {
  isCreating: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editAvatar: string;
  setEditAvatar: (value: string) => void;
  editAvatarImage?: string;
  editAgent: string;
  setEditAgent: (value: string) => void;
  editRecommendedPromptsText: string;
  setEditRecommendedPromptsText: (value: string) => void;
  defaultModelMode: 'unset' | 'auto' | 'fixed';
  setDefaultModelMode: (value: 'unset' | 'auto' | 'fixed') => void;
  defaultModelValue: string;
  setDefaultModelValue: (value: string) => void;
  defaultPermissionMode: 'unset' | 'auto' | 'fixed';
  setDefaultPermissionMode: (value: 'unset' | 'auto' | 'fixed') => void;
  defaultPermissionValue: string;
  setDefaultPermissionValue: (value: string) => void;
  defaultSkillsMode: 'auto' | 'fixed';
  setDefaultSkillsMode: (value: 'auto' | 'fixed') => void;
  defaultMcpMode: 'unset' | 'auto' | 'fixed';
  setDefaultMcpMode: (value: 'unset' | 'auto' | 'fixed') => void;
  availableMcpServers: IMcpServer[];
  selectedMcpIds: string[];
  setSelectedMcpIds: (value: string[]) => void;
  editContext: string;
  setEditContext: (value: string) => void;
  promptViewMode: 'edit' | 'preview';
  setPromptViewMode: (value: 'edit' | 'preview') => void;
  availableSkills: SkillInfo[];
  selectedSkills: string[];
  setSelectedSkills: (value: string[]) => void;
  pendingSkills: Array<{ name: string; description: string }>;
  setDeletePendingSkillName: (value: string | null) => void;
  setDeleteCustomSkillName: (value: string | null) => void;
  builtinAutoSkills: BuiltinAutoSkill[];
  disabledBuiltinSkills: string[];
  setDisabledBuiltinSkills: (value: string[]) => void;
  activeAssistant: AssistantListItem | null;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  availableBackends: AvailableBackend[];
  handleDuplicate: (assistant: AssistantListItem) => void;
};

type SectionCardProps = {
  title: string;
  legend?: { label: string; tone: 'now' | 'next' };
  readOnly?: boolean;
  readOnlyLabel: string;
  extra?: React.ReactNode;
  testId?: string;
  children: React.ReactNode;
};

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  legend,
  readOnly,
  readOnlyLabel,
  extra,
  testId,
  children,
}) => {
  return (
    <section
      data-testid={testId}
      className='rounded-12px border border-border-2 bg-2 px-[12px] py-[16px] md:rounded-16px md:px-[24px] md:py-[20px]'
    >
      <div className='mb-12px flex items-center gap-8px'>
        <div className='text-14px font-500 text-t-primary'>{title}</div>
        {legend ? (
          <span
            className={`rounded-6px px-8px py-2px text-10px font-500 ${
              legend.tone === 'now'
                ? 'bg-[rgba(var(--success-6),0.12)] text-[rgb(var(--success-6))]'
                : 'bg-[rgba(var(--warning-6),0.12)] text-[rgb(var(--warning-6))]'
            }`}
          >
            {legend.label}
          </span>
        ) : null}
        {readOnly ? (
          <span className='ml-auto rounded-8px bg-fill-1 px-8px py-3px text-10px font-500 text-t-tertiary'>
            {readOnlyLabel}
          </span>
        ) : null}
        {extra ? <div className='ml-auto'>{extra}</div> : null}
      </div>
      {children}
    </section>
  );
};

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required = false }) => {
  return (
    <div className='w-86px flex-shrink-0 text-13px text-t-secondary'>
      {required ? <span className='mr-4px text-[rgb(var(--danger-6))]'>*</span> : null}
      {children}
    </div>
  );
};

type ConfigRowProps = {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
};

const ConfigRow: React.FC<ConfigRowProps> = ({ label, children, hint }) => {
  return (
    <div className='flex items-start gap-12px'>
      <FieldLabel>{label}</FieldLabel>
      <div className='min-w-0 flex-1 space-y-8px'>
        {children}
        {hint ? <div className='text-11px leading-18px text-t-tertiary'>{hint}</div> : null}
      </div>
    </div>
  );
};

const ReadonlySelectionField: React.FC<{ value: string }> = ({ value }) => {
  return (
    <div className='min-h-32px rounded-8px border border-border-2 bg-fill-1 px-12px py-8px text-13px leading-20px text-t-secondary'>
      {value}
    </div>
  );
};

const AssistantEditorSections: React.FC<AssistantEditorSectionsProps> = ({
  isCreating,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editAvatar,
  setEditAvatar,
  editAvatarImage,
  editAgent,
  setEditAgent,
  editRecommendedPromptsText,
  setEditRecommendedPromptsText,
  defaultModelMode,
  setDefaultModelMode,
  defaultModelValue,
  setDefaultModelValue,
  defaultPermissionMode,
  setDefaultPermissionMode,
  defaultPermissionValue,
  setDefaultPermissionValue,
  defaultSkillsMode,
  setDefaultSkillsMode,
  defaultMcpMode,
  setDefaultMcpMode,
  availableMcpServers,
  selectedMcpIds,
  setSelectedMcpIds,
  editContext,
  setEditContext,
  promptViewMode,
  setPromptViewMode,
  availableSkills,
  selectedSkills,
  setSelectedSkills,
  pendingSkills,
  setDeletePendingSkillName: _setDeletePendingSkillName,
  setDeleteCustomSkillName: _setDeleteCustomSkillName,
  builtinAutoSkills,
  disabledBuiltinSkills,
  setDisabledBuiltinSkills,
  activeAssistant,
  isExtensionAssistant,
  availableBackends,
  handleDuplicate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { providers, getAvailableModels } = useModelProviderList();
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [addingPrompt, setAddingPrompt] = useState(false);
  const [newPromptDraft, setNewPromptDraft] = useState('');
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [editingPromptDraft, setEditingPromptDraft] = useState('');
  const [skillsPopupVisible, setSkillsPopupVisible] = useState(false);
  const [mcpPopupVisible, setMcpPopupVisible] = useState(false);

  const isBuiltin = activeAssistant?.source === 'builtin';
  const isExtension = activeAssistant?.source === 'extension';
  const isProfileEditable = !isBuiltin && !isExtension;
  const isAgentEditable = !isExtension;
  const canEditDefaultModelAndPermission = !isExtension;
  const canEditDefaultSkillsAndMcps = !isBuiltin && !isExtension;
  const isPromptEditable = !isBuiltin && !isExtension;
  const isRuleEditable = !isBuiltin && !isExtension;
  const showSkills = isCreating || (activeAssistant !== null && activeAssistant.source !== 'extension');
  const currentBackend = availableBackends.find((option) => option.id === editAgent);
  const providerModelOptions = providers.flatMap((provider) =>
    getAvailableModels(provider).map((modelName) => ({
      key: `${provider.id}-${modelName}`,
      value: modelName,
      label: `${provider.name || provider.id} · ${modelName}`,
    }))
  );
  const modelOptions = useMemo(() => {
    if (currentBackend && currentBackend.modelOptions.length > 0) {
      return currentBackend.modelOptions.map((model) => ({
        key: `${editAgent}-${model.value}`,
        value: model.value,
        label: model.label,
      }));
    }

    if (editAgent === 'aionrs') {
      return providerModelOptions;
    }

    return [];
  }, [currentBackend, editAgent, providerModelOptions]);
  const permissionOptions = getAgentModes(editAgent);
  const enabledMcpServers = availableMcpServers.filter((server) => server.enabled !== false);
  const recommendedPromptItems = useMemo(
    () =>
      editRecommendedPromptsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    [editRecommendedPromptsText]
  );
  const readOnlyLabel = t('common.readOnly', { defaultValue: 'Read only' });
  const rulesContainerHeight = rulesExpanded ? '440px' : promptViewMode === 'edit' ? '280px' : '240px';
  const autoSkillNames = builtinAutoSkills.map((skill) => skill.name);
  const autoDefaultOptionLabel = t('settings.assistantSelectAutoRememberLastUsed', {
    defaultValue: 'Remember last used automatically',
  });
  const unsetDefaultOptionLabel = t('settings.assistantSelectDefaultUnset', {
    defaultValue: 'Not configured',
  });
  const selectedItemsLabel = (count: number) =>
    t('settings.assistantSelectedCount', {
      defaultValue: 'Selected {{count}} items',
      count,
    });
  const editableSkillOptions = useMemo(() => {
    const optionMap = new Map<string, { value: string; label: string; isAuto?: boolean; disabled?: boolean }>();

    pendingSkills.forEach((skill) => {
      optionMap.set(skill.name, { value: skill.name, label: skill.name });
    });

    availableSkills.forEach((skill) => {
      optionMap.set(skill.name, {
        value: skill.name,
        label: skill.name,
      });
    });

    builtinAutoSkills.forEach((skill) => {
      optionMap.set(skill.name, {
        value: skill.name,
        label: skill.name,
        isAuto: true,
      });
    });

    return Array.from(optionMap.values());
  }, [availableSkills, builtinAutoSkills, pendingSkills, t]);
  const selectedSkillValues = useMemo(
    () =>
      Array.from(
        new Set([
          ...selectedSkills,
          ...builtinAutoSkills
            .filter((skill) => !disabledBuiltinSkills.includes(skill.name))
            .map((skill) => skill.name),
        ])
      ),
    [builtinAutoSkills, disabledBuiltinSkills, selectedSkills]
  );

  const applyPromptItems = (items: string[]) => {
    setEditRecommendedPromptsText(items.join('\n'));
  };

  const readonlySelectionSummary = (items: string[], emptyLabel: string) =>
    items.length > 0 ? items.join('、') : emptyLabel;

  const handleBeginPromptEdit = (index: number) => {
    setEditingPromptIndex(index);
    setEditingPromptDraft(recommendedPromptItems[index] ?? '');
  };

  const handleSavePromptEdit = () => {
    if (editingPromptIndex === null) return;
    const trimmed = editingPromptDraft.trim();
    if (!trimmed) return;
    const nextItems = [...recommendedPromptItems];
    nextItems[editingPromptIndex] = trimmed;
    applyPromptItems(nextItems);
    setEditingPromptIndex(null);
    setEditingPromptDraft('');
  };

  const handleDeletePrompt = (index: number) => {
    applyPromptItems(recommendedPromptItems.filter((_, promptIndex) => promptIndex !== index));
    if (editingPromptIndex === index) {
      setEditingPromptIndex(null);
      setEditingPromptDraft('');
    }
  };

  const handleAddPrompt = () => {
    const trimmed = newPromptDraft.trim();
    if (!trimmed) return;
    applyPromptItems([...recommendedPromptItems, trimmed]);
    setAddingPrompt(false);
    setNewPromptDraft('');
  };

  const handleSkillSelectionChange = (values: string[]) => {
    const nextSelected = values.filter((value) => !autoSkillNames.includes(value));
    const nextDisabledAuto = autoSkillNames.filter((skillName) => !values.includes(skillName));
    setSelectedSkills(nextSelected);
    setDisabledBuiltinSkills(nextDisabledAuto);
  };

  return (
    <div className='flex flex-col gap-16px pb-24px'>
      {isBuiltin && activeAssistant ? (
        <div
          className='rounded-12px border border-border-2 bg-fill-1 px-14px py-12px text-13px leading-20px text-t-secondary md:rounded-16px'
          data-testid='assistant-builtin-readonly-banner'
        >
          <div className='flex items-start gap-8px'>
            <Info theme='outline' size={16} className='mt-2px flex-shrink-0 text-primary-6' />
            <div>
              <span>
                {t('settings.assistantBuiltinReadonlyTip', {
                  defaultValue:
                    'This is a builtin assistant. You can change Main Agent, Default Model, and Default Permission. To customize other fields, ',
                })}
              </span>
              <Button
                type='text'
                size='mini'
                className='!px-0 !text-primary-6 hover:!text-primary-5'
                onClick={(event) => {
                  event.preventDefault();
                  handleDuplicate(activeAssistant);
                }}
                data-testid='link-duplicate-from-banner'
              >
                {t('settings.assistantBuiltinReadonlyDuplicateLink', { defaultValue: 'duplicate it' })}
              </Button>
              <span>{t('settings.assistantBuiltinReadonlyTipSuffix', { defaultValue: '.' })}</span>
            </div>
          </div>
        </div>
      ) : null}

      <SectionCard
        title={t('settings.assistantIdentitySection', { defaultValue: 'Identity' })}
        legend={{
          label: t('settings.assistantEffectiveImmediately', { defaultValue: 'Applies immediately' }),
          tone: 'now',
        }}
        readOnly={isBuiltin || isExtension}
        readOnlyLabel={readOnlyLabel}
        testId='assistant-card-identity'
      >
        <div className='flex items-start gap-14px'>
          {!isProfileEditable ? (
            <Avatar shape='square' size={42} className='!rounded-10px bg-fill-1'>
              {editAvatarImage ? (
                <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
              ) : editAvatar ? (
                <span className='text-20px'>{editAvatar}</span>
              ) : (
                <Robot theme='outline' size={20} />
              )}
            </Avatar>
          ) : (
            <EmojiPicker value={editAvatar} onChange={(emoji) => setEditAvatar(emoji)} placement='br'>
              <Button type='text' className='!h-42px !w-42px !rounded-10px !bg-fill-1 !p-0'>
                <Avatar shape='square' size={42} className='!rounded-10px bg-fill-1'>
                  {editAvatarImage ? (
                    <img src={editAvatarImage} alt='' width={24} height={24} style={{ objectFit: 'contain' }} />
                  ) : editAvatar ? (
                    <span className='text-20px'>{editAvatar}</span>
                  ) : (
                    <Robot theme='outline' size={20} />
                  )}
                </Avatar>
              </Button>
            </EmojiPicker>
          )}
          <div className='min-w-0 flex-1 space-y-10px'>
            <div className='flex items-center gap-12px'>
              <FieldLabel required>{t('settings.assistantName', { defaultValue: 'Name' })}</FieldLabel>
              <Input
                value={editName}
                onChange={(value) => setEditName(value)}
                disabled={!isProfileEditable}
                placeholder={t('settings.agentNamePlaceholder', { defaultValue: 'Enter a name for this agent' })}
                data-testid='input-assistant-name'
                className='rounded-8px border-border-2 bg-bg-0'
              />
            </div>
            <div className='flex items-center gap-12px'>
              <FieldLabel>{t('settings.assistantDescription', { defaultValue: 'Description' })}</FieldLabel>
              <Input
                value={editDescription}
                onChange={(value) => setEditDescription(value)}
                disabled={!isProfileEditable}
                data-testid='input-assistant-desc'
                placeholder={t('settings.assistantDescriptionPlaceholder', {
                  defaultValue: 'What can this assistant help with?',
                })}
                className='rounded-8px border-border-2 bg-bg-0'
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings.assistantRecommendedPromptsLabel', { defaultValue: 'Recommended Prompts' })}
        legend={{
          label: t('settings.assistantEffectiveImmediately', { defaultValue: 'Applies immediately' }),
          tone: 'now',
        }}
        readOnly={!isPromptEditable}
        readOnlyLabel={readOnlyLabel}
        extra={
          isPromptEditable ? (
            <Button
              type='outline'
              size='small'
              className='!rounded-full'
              aria-label={t('common.add', { defaultValue: 'Add' })}
              onClick={() => {
                setAddingPrompt(true);
                setEditingPromptIndex(null);
                setEditingPromptDraft('');
              }}
            >
              + {t('common.add', { defaultValue: 'Add' })}
            </Button>
          ) : null
        }
        testId='assistant-card-prompts'
      >
        <div className='space-y-12px rounded-12px border border-border-2 bg-fill-1 px-12px py-14px'>
          {addingPrompt && isPromptEditable ? (
            <div className='flex items-center gap-8px rounded-10px bg-base p-10px'>
              <Input
                value={newPromptDraft}
                onChange={(value) => setNewPromptDraft(value)}
                placeholder={t('settings.assistantRecommendedPromptsPlaceholder', {
                  defaultValue: 'Enter one suggested prompt per line',
                })}
                data-testid='input-assistant-recommended-prompt-new'
              />
              <Button size='small' type='primary' className='!rounded-full' onClick={handleAddPrompt}>
                {t('common.add', { defaultValue: 'Add' })}
              </Button>
              <Button
                size='small'
                type='secondary'
                className='!rounded-full'
                onClick={() => {
                  setAddingPrompt(false);
                  setNewPromptDraft('');
                }}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
            </div>
          ) : null}

          {recommendedPromptItems.length > 0 ? (
            <div className='space-y-12px'>
              {recommendedPromptItems.map((prompt, index) => {
                const isEditingPrompt = editingPromptIndex === index;
                return (
                  <div key={`${prompt}-${index}`} className='flex items-start gap-12px'>
                    <div className='w-24px pt-10px text-right text-12px font-500 text-t-quaternary'>{index + 1}.</div>
                    <div className='min-w-0 flex-1'>
                      {isEditingPrompt ? (
                        <div className='space-y-8px'>
                          <Input
                            value={editingPromptDraft}
                            onChange={(value) => setEditingPromptDraft(value)}
                            data-testid={`input-assistant-recommended-prompt-${index}`}
                          />
                          <div className='flex items-center gap-8px'>
                            <Button
                              size='small'
                              type='primary'
                              className='!rounded-full'
                              onClick={handleSavePromptEdit}
                            >
                              {t('common.save', { defaultValue: 'Save' })}
                            </Button>
                            <Button
                              size='small'
                              type='secondary'
                              className='!rounded-full'
                              onClick={() => {
                                setEditingPromptIndex(null);
                                setEditingPromptDraft('');
                              }}
                            >
                              {t('common.cancel', { defaultValue: 'Cancel' })}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex items-start gap-12px'>
                          <div className='min-h-36px flex-1 px-4px py-8px text-13px font-500 leading-22px text-t-primary'>
                            {prompt}
                          </div>
                          {isPromptEditable ? (
                            <div className='flex flex-shrink-0 items-center gap-8px'>
                              <Button
                                size='small'
                                type='secondary'
                                className='!rounded-full'
                                onClick={() => handleBeginPromptEdit(index)}
                              >
                                {t('common.edit', { defaultValue: 'Edit' })}
                              </Button>
                              <Button
                                size='small'
                                type='secondary'
                                className='!rounded-full'
                                onClick={() => handleDeletePrompt(index)}
                              >
                                {t('common.delete', { defaultValue: 'Delete' })}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings.assistantEngineSection', { defaultValue: 'Engine' })}
        readOnly={false}
        readOnlyLabel={readOnlyLabel}
        testId='assistant-card-engine'
      >
        <div className='flex items-center gap-12px'>
          <FieldLabel>{t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}</FieldLabel>
          <div className='min-w-0 flex-1'>
            <Select
              className='w-full'
              value={editAgent}
              onChange={(value) => setEditAgent(value as string)}
              disabled={!isAgentEditable}
              data-testid='select-assistant-agent'
            >
              {availableBackends.map((option) => (
                <Select.Option key={option.id} value={option.id}>
                  <span className='flex items-center gap-6px'>
                    {option.name}
                    {option.isExtension ? (
                      <Tag size='small' color='arcoblue'>
                        ext
                      </Tag>
                    ) : null}
                  </span>
                </Select.Option>
              ))}
            </Select>
            <div className='mt-6px text-11px text-t-tertiary'>
              {t('settings.assistantEngineAffectsDefaults', {
                defaultValue: 'Changing the main agent updates which model and permission values are available below.',
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings.assistantDefaultConfigSection', { defaultValue: 'Default Configuration' })}
        legend={{
          label: t('settings.assistantOnlyNewConversation', { defaultValue: 'New conversations only' }),
          tone: 'next',
        }}
        readOnly={isBuiltin || isExtension}
        readOnlyLabel={readOnlyLabel}
        testId='assistant-card-defaults'
      >
        <div className='space-y-16px'>
          <ConfigRow
            label={t('settings.assistantDefaultModelLabel', { defaultValue: 'Default Model' })}
            hint={t('settings.assistantDefaultConfigHint', {
              defaultValue:
                'Not configured applies no assistant-level default. Remember last used only takes effect after this assistant has recorded a previous selection.',
            })}
          >
            <Select
              value={
                defaultModelMode === 'fixed' && defaultModelValue
                  ? defaultModelValue
                  : defaultModelMode === 'auto'
                    ? '__AUTO__'
                    : '__UNSET__'
              }
              onChange={(value) => {
                const nextValue = value as string;
                if (nextValue === '__UNSET__') {
                  setDefaultModelMode('unset');
                  setDefaultModelValue('');
                  return;
                }
                if (nextValue === '__AUTO__') {
                  setDefaultModelMode('auto');
                  setDefaultModelValue('');
                  return;
                }
                setDefaultModelMode('fixed');
                setDefaultModelValue(nextValue);
              }}
              disabled={!canEditDefaultModelAndPermission}
              allowClear={false}
              placeholder={t('settings.assistantSelectDefaultModel', { defaultValue: 'Select a model' })}
              notFoundContent={t('settings.assistantNoAvailableModels', {
                defaultValue: 'No available models configured',
              })}
              data-testid='select-assistant-default-model'
            >
              <Select.Option value='__UNSET__'>{unsetDefaultOptionLabel}</Select.Option>
              <Select.Option value='__AUTO__'>{autoDefaultOptionLabel}</Select.Option>
              {modelOptions.map((option) => (
                <Select.Option key={option.key} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </ConfigRow>

          <ConfigRow label={t('settings.assistantDefaultPermissionLabel', { defaultValue: 'Default Permission' })}>
            <Select
              value={
                defaultPermissionMode === 'fixed' && defaultPermissionValue
                  ? defaultPermissionValue
                  : defaultPermissionMode === 'auto'
                    ? '__AUTO__'
                    : '__UNSET__'
              }
              onChange={(value) => {
                const nextValue = value as string;
                if (nextValue === '__UNSET__') {
                  setDefaultPermissionMode('unset');
                  setDefaultPermissionValue('');
                  return;
                }
                if (nextValue === '__AUTO__') {
                  setDefaultPermissionMode('auto');
                  setDefaultPermissionValue('');
                  return;
                }
                setDefaultPermissionMode('fixed');
                setDefaultPermissionValue(nextValue);
              }}
              disabled={!canEditDefaultModelAndPermission}
              allowClear={false}
              placeholder={t('settings.assistantSelectDefaultPermission', {
                defaultValue: 'Select a permission mode',
              })}
              notFoundContent={t('settings.assistantNoPermissionModes', {
                defaultValue: 'This main agent has no switchable permission modes.',
              })}
              data-testid='select-assistant-default-permission'
            >
              <Select.Option value='__UNSET__'>{unsetDefaultOptionLabel}</Select.Option>
              <Select.Option value='__AUTO__'>{autoDefaultOptionLabel}</Select.Option>
              {permissionOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </ConfigRow>

          {showSkills ? (
            <ConfigRow
              label={t('settings.assistantDefaultSkillsLabel', { defaultValue: 'Default Skills' })}
              hint={
                <Button
                  type='text'
                  size='mini'
                  onClick={() => navigate('/settings/capabilities?tab=skills')}
                  data-testid='btn-open-skills-settings'
                  className='!h-auto !px-0 !text-primary-6'
                >
                  {t('settings.skillsHub.manageInHub', { defaultValue: 'Manage in Skills Hub' })}
                </Button>
              }
            >
              {canEditDefaultSkillsAndMcps ? (
                <Select
                  mode='multiple'
                  popupVisible={skillsPopupVisible}
                  onVisibleChange={setSkillsPopupVisible}
                  value={defaultSkillsMode === 'fixed' ? selectedSkillValues : []}
                  onChange={(value) => {
                    setDefaultSkillsMode('fixed');
                    handleSkillSelectionChange((value as string[]) ?? []);
                  }}
                  onClear={() => {
                    setDefaultSkillsMode('auto');
                    setSkillsPopupVisible(false);
                  }}
                  allowClear
                  maxTagCount={{
                    count: 0,
                    render: () => selectedItemsLabel(selectedSkillValues.length),
                  }}
                  placeholder={
                    defaultSkillsMode === 'auto'
                      ? autoDefaultOptionLabel
                      : t('settings.assistantDefaultSkillsLabel', { defaultValue: 'Default Skills' })
                  }
                  data-testid='select-assistant-default-skills'
                  dropdownRender={(menu) => (
                    <div>
                      <Button
                        type='text'
                        size='small'
                        className='!mx-8px !mt-8px !justify-start !px-8px !text-primary-6'
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDefaultSkillsMode('auto');
                          setSkillsPopupVisible(false);
                        }}
                      >
                        {autoDefaultOptionLabel}
                      </Button>
                      {menu}
                    </div>
                  )}
                  renderFormat={() =>
                    defaultSkillsMode === 'auto'
                      ? autoDefaultOptionLabel
                      : readonlySelectionSummary(
                          selectedSkillValues,
                          t('settings.assistantNoDefaultSkillsSelected', { defaultValue: 'No default skills selected' })
                        )
                  }
                >
                  {editableSkillOptions.map((option) => (
                    <Select.Option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <ReadonlySelectionField
                  value={
                    defaultSkillsMode === 'auto'
                      ? autoDefaultOptionLabel
                      : readonlySelectionSummary(
                          selectedSkillValues,
                          t('settings.assistantNoDefaultSkillsSelected', { defaultValue: 'No default skills selected' })
                        )
                  }
                />
              )}
            </ConfigRow>
          ) : null}

          <ConfigRow
            label={t('settings.assistantDefaultMcpLabel', { defaultValue: 'Default MCP' })}
            hint={
              <Button
                type='text'
                size='mini'
                onClick={() => navigate('/settings/capabilities?tab=tools')}
                data-testid='btn-open-mcp-settings'
                className='!h-auto !px-0 !text-primary-6'
              >
                {t('settings.assistantOpenMcpSettings', { defaultValue: 'Open MCP settings' })}
              </Button>
            }
          >
            {canEditDefaultSkillsAndMcps ? (
              <Select
                mode='multiple'
                popupVisible={mcpPopupVisible}
                onVisibleChange={setMcpPopupVisible}
                value={defaultMcpMode === 'fixed' ? selectedMcpIds : []}
                onChange={(value) => {
                  setDefaultMcpMode('fixed');
                  setSelectedMcpIds((value as string[]) ?? []);
                }}
                onClear={() => {
                  setDefaultMcpMode('auto');
                  setMcpPopupVisible(false);
                }}
                allowClear
                maxTagCount={{
                  count: 0,
                  render: () => selectedItemsLabel(selectedMcpIds.length),
                }}
                placeholder={
                  defaultMcpMode === 'unset'
                    ? unsetDefaultOptionLabel
                    : defaultMcpMode === 'auto'
                      ? autoDefaultOptionLabel
                      : t('settings.assistantSelectDefaultMcp', { defaultValue: 'Select MCP servers' })
                }
                notFoundContent={t('settings.assistantNoAvailableMcps', {
                  defaultValue: 'No enabled MCP servers are available.',
                })}
                data-testid='select-assistant-default-mcp'
                dropdownRender={(menu) => (
                  <div>
                    <Button
                      type='text'
                      size='small'
                      className='!mx-8px !mt-8px !justify-start !px-8px !text-primary-6'
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDefaultMcpMode('unset');
                        setSelectedMcpIds([]);
                        setMcpPopupVisible(false);
                      }}
                    >
                      {unsetDefaultOptionLabel}
                    </Button>
                    <Button
                      type='text'
                      size='small'
                      className='!mx-8px !mt-8px !justify-start !px-8px !text-primary-6'
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDefaultMcpMode('auto');
                        setMcpPopupVisible(false);
                      }}
                    >
                      {autoDefaultOptionLabel}
                    </Button>
                    {menu}
                  </div>
                )}
                renderFormat={() =>
                  defaultMcpMode === 'unset'
                    ? unsetDefaultOptionLabel
                    : defaultMcpMode === 'auto'
                      ? autoDefaultOptionLabel
                      : readonlySelectionSummary(
                          enabledMcpServers
                            .filter((server) => selectedMcpIds.includes(server.id))
                            .map((server) => server.name),
                          t('settings.assistantNoDefaultMcpsSelected', { defaultValue: 'No default MCP selected' })
                        )
                }
              >
                {enabledMcpServers.map((server) => (
                  <Select.Option key={server.id} value={server.id}>
                    {server.name}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <ReadonlySelectionField
                value={
                  defaultMcpMode === 'unset'
                    ? unsetDefaultOptionLabel
                    : defaultMcpMode === 'auto'
                      ? autoDefaultOptionLabel
                      : readonlySelectionSummary(
                          enabledMcpServers
                            .filter((server) => selectedMcpIds.includes(server.id))
                            .map((server) => server.name),
                          t('settings.assistantNoDefaultMcpsSelected', { defaultValue: 'No default MCP selected' })
                        )
                }
              />
            )}
          </ConfigRow>
        </div>
      </SectionCard>

      <SectionCard
        title={t('settings.assistantRules', { defaultValue: 'Rules' })}
        legend={{
          label: t('settings.assistantOnlyNewConversation', { defaultValue: 'New conversations only' }),
          tone: 'next',
        }}
        readOnly={isBuiltin || isExtension}
        readOnlyLabel={readOnlyLabel}
        extra={
          <div className='flex items-center gap-6px'>
            {isRuleEditable ? (
              <div className='flex items-center rounded-10px bg-fill-1 p-2px'>
                <Button
                  type='text'
                  size='mini'
                  className={`${promptViewMode === 'edit' ? '!rounded-8px !bg-base !text-primary-6' : '!rounded-8px !text-t-secondary'}`}
                  onClick={() => setPromptViewMode('edit')}
                >
                  {t('settings.promptEdit', { defaultValue: 'Edit' })}
                </Button>
                <Button
                  type='text'
                  size='mini'
                  className={`${promptViewMode === 'preview' ? '!rounded-8px !bg-base !text-primary-6' : '!rounded-8px !text-t-secondary'}`}
                  onClick={() => setPromptViewMode('preview')}
                >
                  {t('settings.promptPreview', { defaultValue: 'Preview' })}
                </Button>
              </div>
            ) : null}
            <Button
              type='text'
              size='mini'
              data-testid='btn-expand-rules'
              onClick={() => setRulesExpanded((previous) => !previous)}
            >
              {rulesExpanded
                ? t('common.collapse', { defaultValue: 'Collapse' })
                : t('common.expand', { defaultValue: 'Expand' })}
            </Button>
          </div>
        }
        testId='assistant-card-rules'
      >
        <div
          className='overflow-hidden rounded-12px border border-border-2 bg-fill-1'
          style={{ height: rulesContainerHeight }}
        >
          {promptViewMode === 'edit' && isRuleEditable ? (
            <div className='h-full'>
              <Input.TextArea
                value={editContext}
                onChange={(value) => setEditContext(value)}
                placeholder={t('settings.assistantRulesPlaceholder', {
                  defaultValue: 'Enter rules in Markdown format...',
                })}
                autoSize={false}
                className='!h-full !rounded-none !border-none !bg-transparent'
              />
            </div>
          ) : (
            <div className='h-full overflow-auto px-14px py-12px text-13px leading-22px text-t-secondary'>
              {editContext ? (
                <MarkdownView hiddenCodeCopyButton>{editContext}</MarkdownView>
              ) : (
                <div className='py-24px text-center text-t-tertiary'>
                  {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {activeAssistant && isExtensionAssistant(activeAssistant) ? (
        <div className='px-4px text-12px text-t-tertiary'>
          {t('settings.assistantExtensionReadonlyTip', {
            defaultValue: 'Extension assistants are read-only in assistant settings.',
          })}
        </div>
      ) : null}
    </div>
  );
};

export default AssistantEditorSections;
