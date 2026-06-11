import type { BuiltinAutoSkill, SkillInfo } from '../types';
import type { IMcpServer } from '@/common/config/storage';
import { Button, Select } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConfigRow, ReadonlySelectionField, SectionCard } from './editorSectionPrimitives';

type SelectOption = { key: string; value: string; label: string };
type EditableSkillOption = { value: string; label: string; isAuto?: boolean; disabled?: boolean };

const getEditorSelectPopupContainer = (node: HTMLElement) =>
  node.closest('[data-editor-popup-root]') ?? node.parentElement ?? document.body;

type DefaultsSectionProps = {
  isBuiltin: boolean;
  isCreating: boolean;
  showSkills: boolean;
  defaultModelMode: 'auto' | 'fixed';
  setDefaultModelMode: (value: 'auto' | 'fixed') => void;
  defaultModelValue: string;
  setDefaultModelValue: (value: string) => void;
  defaultPermissionMode: 'auto' | 'fixed';
  setDefaultPermissionMode: (value: 'auto' | 'fixed') => void;
  defaultPermissionValue: string;
  setDefaultPermissionValue: (value: string) => void;
  defaultSkillsMode: 'auto' | 'fixed';
  setDefaultSkillsMode: (value: 'auto' | 'fixed') => void;
  defaultMcpMode: 'auto' | 'fixed';
  setDefaultMcpMode: (value: 'auto' | 'fixed') => void;
  modelOptions: SelectOption[];
  permissionOptions: Array<{ value: string; label: string }>;
  editableSkillOptions: EditableSkillOption[];
  selectedSkillValues: string[];
  enabledMcpServers: IMcpServer[];
  selectedMcpIds: string[];
  setSelectedMcpIds: (value: string[]) => void;
  handleSkillSelectionChange: (values: string[]) => void;
  readOnlyLabel: string;
  selectedItemsLabel: (count: number) => string;
  autoDefaultOptionLabel: string;
  readonlySelectionSummary: (items: string[], emptyLabel: string) => string;
};

const DefaultsSection: React.FC<DefaultsSectionProps> = ({
  isBuiltin,
  showSkills,
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
  modelOptions,
  permissionOptions,
  editableSkillOptions,
  selectedSkillValues,
  enabledMcpServers,
  selectedMcpIds,
  setSelectedMcpIds,
  handleSkillSelectionChange,
  readOnlyLabel,
  selectedItemsLabel,
  autoDefaultOptionLabel,
  readonlySelectionSummary,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEditDefaultModelAndPermission = true;
  const canEditDefaultSkillsAndMcps = !isBuiltin;

  return (
    <SectionCard
      title={t('settings.assistantDefaultConfigSection', { defaultValue: 'Default Configuration' })}
      legend={{
        label: t('settings.assistantOnlyNewConversation', { defaultValue: 'New conversations only' }),
        tone: 'next',
      }}
      readOnly={isBuiltin}
      readOnlyLabel={readOnlyLabel}
      testId='assistant-card-defaults'
    >
      <div className='space-y-16px'>
        <ConfigRow
          label={t('settings.assistantDefaultModelLabel', { defaultValue: 'Default Model' })}
          hint={t('settings.assistantDefaultConfigHint', {
            defaultValue:
              'Remember last used only takes effect after this assistant has recorded a previous selection.',
          })}
        >
          <Select
            getPopupContainer={getEditorSelectPopupContainer}
            value={defaultModelMode === 'fixed' && defaultModelValue ? defaultModelValue : '__AUTO__'}
            onChange={(value) => {
              const nextValue = value as string;
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
            getPopupContainer={getEditorSelectPopupContainer}
            value={defaultPermissionMode === 'fixed' && defaultPermissionValue ? defaultPermissionValue : '__AUTO__'}
            onChange={(value) => {
              const nextValue = value as string;
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
                getPopupContainer={getEditorSelectPopupContainer}
                mode='multiple'
                value={defaultSkillsMode === 'fixed' ? selectedSkillValues : []}
                onChange={(value) => {
                  setDefaultSkillsMode('fixed');
                  handleSkillSelectionChange((value as string[]) ?? []);
                }}
                onClear={() => setDefaultSkillsMode('auto')}
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
              getPopupContainer={getEditorSelectPopupContainer}
              mode='multiple'
              value={defaultMcpMode === 'fixed' ? selectedMcpIds : []}
              onChange={(value) => {
                setDefaultMcpMode('fixed');
                setSelectedMcpIds((value as string[]) ?? []);
              }}
              onClear={() => setDefaultMcpMode('auto')}
              allowClear
              maxTagCount={{
                count: 0,
                render: () => selectedItemsLabel(selectedMcpIds.length),
              }}
              placeholder={
                defaultMcpMode === 'auto'
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
                      setDefaultMcpMode('auto');
                    }}
                  >
                    {autoDefaultOptionLabel}
                  </Button>
                  {menu}
                </div>
              )}
              renderFormat={() =>
                defaultMcpMode === 'auto'
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
                defaultMcpMode === 'auto'
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
  );
};

export default DefaultsSection;
