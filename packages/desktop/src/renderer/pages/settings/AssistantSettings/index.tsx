/**
 * AssistantSettings — Settings page for managing assistants.
 *
 * Editing permissions by assistant type:
 *
 * | Field          | Builtin | Extension | Custom |
 * |----------------|---------|-----------|--------|
 * | Save button    |  yes    |  no       |  yes   |
 * | Name           |  no     |  no       |  yes   |
 * | Description    |  no     |  no       |  yes   |
 * | Avatar         |  no     |  no       |  yes   |
 * | Main Agent     |  yes    |  no       |  yes   |
 * | Prompt editing |  no     |  no       |  yes   |
 * | Delete         |  no     |  no       |  yes   |
 *
 * Builtin assistants only allow Main Agent overrides. Extension assistants are
 * fully read-only. The full-page editor still renders their skills panel so
 * users can inspect what's bundled.
 */
import { Message } from '@arco-design/web-react';
import coworkSvg from '@/renderer/assets/icons/cowork.svg';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useSettingsViewMode } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { useDetectedAgents, useAssistantEditor, useAssistantList } from '@/renderer/hooks/assistant';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import { resolveAvatarImageSrc } from './assistantUtils';
import AssistantEditorPage from './AssistantEditorPage';
import AssistantListPanel from './AssistantListPanel';
import DeleteAssistantModal from './DeleteAssistantModal';
import SkillConfirmModals from './SkillConfirmModals';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

type AssistantNavigationState = {
  openAssistantId?: string;
  openAssistantEditor?: boolean;
};
const OPEN_ASSISTANT_EDITOR_INTENT_KEY = 'guid.openAssistantEditorIntent';

const AssistantSettings: React.FC = () => {
  const [message, messageContext] = Message.useMessage({ maxCount: 10 });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationState = (location.state as AssistantNavigationState | null) ?? null;
  const highlightId = searchParams.get('highlight');
  const handleHighlightConsumed = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const avatarImageMap: Record<string, string> = useMemo(
    () => ({
      'cowork.svg': coworkSvg,
      '\u{1F6E0}\u{FE0F}': coworkSvg,
    }),
    []
  );

  // Compose hooks
  const {
    assistants,
    activeAssistantId,
    setActiveAssistantId,
    activeAssistant,
    isExtensionAssistant,
    loadAssistants,
    reorderAssistants,
    localeKey,
  } = useAssistantList();

  const { availableBackends, refreshAgentDetection } = useDetectedAgents();

  const editor = useAssistantEditor({
    localeKey,
    activeAssistant,
    isExtensionAssistant,
    setActiveAssistantId,
    loadAssistants,
    refreshAgentDetection,
    message,
  });

  const editAvatarImage = resolveAvatarImageSrc(editor.editAvatar, avatarImageMap);
  const hasConsumedNavigationIntentRef = useRef(false);
  const showEditor = editor.editVisible && (editor.isCreating || activeAssistant !== null);

  useEffect(() => {
    if (hasConsumedNavigationIntentRef.current) return;
    const openAssistantFromRoute =
      navigationState?.openAssistantEditor && navigationState.openAssistantId ? navigationState.openAssistantId : null;

    let openAssistantFromSession: string | null = null;
    try {
      const rawIntent = sessionStorage.getItem(OPEN_ASSISTANT_EDITOR_INTENT_KEY);
      if (rawIntent) {
        const parsedIntent = JSON.parse(rawIntent) as { assistantId?: string; openAssistantEditor?: boolean };
        if (parsedIntent.openAssistantEditor && parsedIntent.assistantId) {
          openAssistantFromSession = parsedIntent.assistantId;
        }
      }
    } catch (error) {
      console.error('[AssistantManagement] Failed to parse assistant open intent:', error);
    }

    const targetAssistantId = openAssistantFromRoute ?? openAssistantFromSession;
    if (!targetAssistantId) return;
    if (assistants.length === 0) return;

    const targetAssistant = assistants.find((assistant) => assistant.id === targetAssistantId);
    if (!targetAssistant) return;

    hasConsumedNavigationIntentRef.current = true;
    try {
      sessionStorage.removeItem(OPEN_ASSISTANT_EDITOR_INTENT_KEY);
    } catch (error) {
      console.error('[AssistantManagement] Failed to clear assistant open intent:', error);
    }
    void editor.handleEdit(targetAssistant);
  }, [assistants, editor, navigationState]);

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col h-full w-full'>
        {messageContext}
        <AionScrollArea className='flex-1 min-h-0 pb-16px scrollbar-hide' disableOverflow={isPageMode}>
          {showEditor ? (
            <AssistantEditorPage
              isCreating={editor.isCreating}
              activeAssistant={activeAssistant}
              editName={editor.editName}
              setEditName={editor.setEditName}
              editDescription={editor.editDescription}
              setEditDescription={editor.setEditDescription}
              editAvatar={editor.editAvatar}
              setEditAvatar={editor.setEditAvatar}
              editAvatarImage={editAvatarImage}
              editAgent={editor.editAgent}
              setEditAgent={editor.setEditAgent}
              editRecommendedPromptsText={editor.editRecommendedPromptsText}
              setEditRecommendedPromptsText={editor.setEditRecommendedPromptsText}
              defaultModelMode={editor.defaultModelMode}
              setDefaultModelMode={editor.setDefaultModelMode}
              defaultModelValue={editor.defaultModelValue}
              setDefaultModelValue={editor.setDefaultModelValue}
              defaultPermissionMode={editor.defaultPermissionMode}
              setDefaultPermissionMode={editor.setDefaultPermissionMode}
              defaultPermissionValue={editor.defaultPermissionValue}
              setDefaultPermissionValue={editor.setDefaultPermissionValue}
              defaultSkillsMode={editor.defaultSkillsMode}
              setDefaultSkillsMode={editor.setDefaultSkillsMode}
              defaultMcpMode={editor.defaultMcpMode}
              setDefaultMcpMode={editor.setDefaultMcpMode}
              availableMcpServers={editor.availableMcpServers}
              selectedMcpIds={editor.selectedMcpIds}
              setSelectedMcpIds={editor.setSelectedMcpIds}
              editContext={editor.editContext}
              setEditContext={editor.setEditContext}
              promptViewMode={editor.promptViewMode}
              setPromptViewMode={editor.setPromptViewMode}
              availableSkills={editor.availableSkills}
              selectedSkills={editor.selectedSkills}
              setSelectedSkills={editor.setSelectedSkills}
              pendingSkills={editor.pendingSkills}
              setDeletePendingSkillName={editor.setDeletePendingSkillName}
              setDeleteCustomSkillName={editor.setDeleteCustomSkillName}
              builtinAutoSkills={editor.builtinAutoSkills}
              disabledBuiltinSkills={editor.disabledBuiltinSkills}
              setDisabledBuiltinSkills={editor.setDisabledBuiltinSkills}
              isExtensionAssistant={isExtensionAssistant}
              availableBackends={availableBackends}
              handleSave={editor.handleSave}
              handleDeleteClick={editor.handleDeleteClick}
              handleDuplicate={(assistant) => void editor.handleDuplicate(assistant)}
              onBack={() => editor.setEditVisible(false)}
            />
          ) : (
            <AssistantListPanel
              assistants={assistants}
              localeKey={localeKey}
              avatarImageMap={avatarImageMap}
              isExtensionAssistant={isExtensionAssistant}
              onEdit={(assistant) => void editor.handleEdit(assistant)}
              onDuplicate={(assistant) => void editor.handleDuplicate(assistant)}
              onCreate={() => void editor.handleCreate()}
              onToggleEnabled={(assistant, checked) => void editor.handleToggleEnabled(assistant, checked)}
              onReorder={(activeId, overId) => void reorderAssistants(activeId, overId)}
              setActiveAssistantId={setActiveAssistantId}
              highlightId={highlightId}
              onHighlightConsumed={handleHighlightConsumed}
            />
          )}

          <DeleteAssistantModal
            visible={editor.deleteConfirmVisible}
            onCancel={() => editor.setDeleteConfirmVisible(false)}
            onConfirm={editor.handleDeleteConfirm}
            activeAssistant={activeAssistant}
            avatarImageMap={avatarImageMap}
          />

          <SkillConfirmModals
            deletePendingSkillName={editor.deletePendingSkillName}
            setDeletePendingSkillName={editor.setDeletePendingSkillName}
            pendingSkills={editor.pendingSkills}
            setPendingSkills={editor.setPendingSkills}
            deleteCustomSkillName={editor.deleteCustomSkillName}
            setDeleteCustomSkillName={editor.setDeleteCustomSkillName}
            customSkills={editor.customSkills}
            setCustomSkills={editor.setCustomSkills}
            selectedSkills={editor.selectedSkills}
            setSelectedSkills={editor.setSelectedSkills}
            message={message}
          />
        </AionScrollArea>
      </div>
    </SettingsPageWrapper>
  );
};

export default AssistantSettings;
