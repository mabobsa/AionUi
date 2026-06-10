import type { AssistantListItem, BuiltinAutoSkill, SkillInfo } from './types';
import type { IMcpServer } from '@/common/config/storage';
import type { AvailableBackend } from '@/renderer/hooks/assistant';
import { Button } from '@arco-design/web-react';
import { ArrowLeft } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AssistantEditorSections from './AssistantEditorSections';

type AssistantEditorPageProps = {
  isCreating: boolean;
  activeAssistant: AssistantListItem | null;
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
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  availableBackends: AvailableBackend[];
  handleSave: () => void;
  handleDeleteClick: () => void;
  handleDuplicate: (assistant: AssistantListItem) => void;
  onBack: () => void;
};

const AssistantEditorPage: React.FC<AssistantEditorPageProps> = ({
  isCreating,
  activeAssistant,
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
  setDeletePendingSkillName,
  setDeleteCustomSkillName,
  builtinAutoSkills,
  disabledBuiltinSkills,
  setDisabledBuiltinSkills,
  isExtensionAssistant,
  availableBackends,
  handleSave,
  handleDeleteClick,
  handleDuplicate,
  onBack,
}) => {
  const { t } = useTranslation();
  const isReadOnlyExtension = !isCreating && activeAssistant !== null && isExtensionAssistant(activeAssistant);

  return (
    <div data-testid='assistant-editor-page'>
      <div className='flex h-full min-h-0 flex-col bg-fill-2 rounded-24px p-20px' data-testid='assistant-editor-page'>
        <div className='mb-16px flex items-center justify-between gap-12px'>
          <div className='flex items-center gap-8px'>
            <Button type='text' icon={<ArrowLeft size={16} />} onClick={onBack} data-testid='btn-back-assistant-editor'>
              {t('common.back', { defaultValue: 'Back' })}
            </Button>
            <div className='text-18px font-600 text-t-primary'>
              {isCreating
                ? t('settings.createAssistant', { defaultValue: 'Create Assistant' })
                : t('settings.editAssistant', { defaultValue: 'Assistant Details' })}
            </div>
          </div>
          <div className='flex items-center gap-8px'>
            {!isCreating && activeAssistant?.source !== 'builtin' && !isExtensionAssistant(activeAssistant) && (
              <Button
                status='danger'
                className='rounded-[100px]'
                style={{ backgroundColor: 'rgb(var(--danger-1))' }}
                onClick={handleDeleteClick}
                data-testid='btn-delete-assistant'
              >
                {t('common.delete', { defaultValue: 'Delete' })}
              </Button>
            )}
            <Button onClick={onBack} className='rounded-[100px] bg-fill-1' data-testid='btn-cancel-assistant-editor'>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type='primary'
              onClick={handleSave}
              disabled={isReadOnlyExtension}
              data-testid='btn-save-assistant'
              className='rounded-[100px]'
            >
              {isCreating ? t('common.create', { defaultValue: 'Create' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-auto'>
          <AssistantEditorSections
            isCreating={isCreating}
            editName={editName}
            setEditName={setEditName}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editAvatar={editAvatar}
            setEditAvatar={setEditAvatar}
            editAvatarImage={editAvatarImage}
            editAgent={editAgent}
            setEditAgent={setEditAgent}
            editRecommendedPromptsText={editRecommendedPromptsText}
            setEditRecommendedPromptsText={setEditRecommendedPromptsText}
            defaultModelMode={defaultModelMode}
            setDefaultModelMode={setDefaultModelMode}
            defaultModelValue={defaultModelValue}
            setDefaultModelValue={setDefaultModelValue}
            defaultPermissionMode={defaultPermissionMode}
            setDefaultPermissionMode={setDefaultPermissionMode}
            defaultPermissionValue={defaultPermissionValue}
            setDefaultPermissionValue={setDefaultPermissionValue}
            defaultSkillsMode={defaultSkillsMode}
            setDefaultSkillsMode={setDefaultSkillsMode}
            defaultMcpMode={defaultMcpMode}
            setDefaultMcpMode={setDefaultMcpMode}
            availableMcpServers={availableMcpServers}
            selectedMcpIds={selectedMcpIds}
            setSelectedMcpIds={setSelectedMcpIds}
            editContext={editContext}
            setEditContext={setEditContext}
            promptViewMode={promptViewMode}
            setPromptViewMode={setPromptViewMode}
            availableSkills={availableSkills}
            selectedSkills={selectedSkills}
            setSelectedSkills={setSelectedSkills}
            pendingSkills={pendingSkills}
            setDeletePendingSkillName={setDeletePendingSkillName}
            setDeleteCustomSkillName={setDeleteCustomSkillName}
            builtinAutoSkills={builtinAutoSkills}
            disabledBuiltinSkills={disabledBuiltinSkills}
            setDisabledBuiltinSkills={setDisabledBuiltinSkills}
            activeAssistant={activeAssistant}
            isExtensionAssistant={isExtensionAssistant}
            availableBackends={availableBackends}
            handleDuplicate={handleDuplicate}
          />
        </div>
      </div>
    </div>
  );
};

export default AssistantEditorPage;
