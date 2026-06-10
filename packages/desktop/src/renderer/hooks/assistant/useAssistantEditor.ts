import { ipcBridge } from '@/common';
import type { IMcpServer } from '@/common/config/storage';
import type { Assistant, CreateAssistantRequest, UpdateAssistantRequest } from '@/common/types/agent/assistantTypes';
import type { Message } from '@arco-design/web-react';
import type {
  AssistantListItem,
  BuiltinAutoSkill,
  PendingSkill,
  SkillInfo,
} from '@/renderer/pages/settings/AssistantSettings/types';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate as swrMutate } from 'swr';

type UseAssistantEditorParams = {
  localeKey: string;
  activeAssistant: AssistantListItem | null;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  setActiveAssistantId: (id: string | null) => void;
  loadAssistants: () => Promise<void>;
  refreshAgentDetection: () => Promise<void>;
  message: ReturnType<typeof Message.useMessage>[0];
};

type AssistantScalarDefaultMode = 'unset' | 'auto' | 'fixed';
type AssistantSkillsDefaultMode = 'auto' | 'fixed';
type AssistantMcpDefaultMode = 'unset' | 'auto' | 'fixed';

const isBuiltinAssistant = (assistant: Assistant | null | undefined): boolean => assistant?.source === 'builtin';

const resolveLocalizedRecommendedPrompts = (
  detail: Awaited<ReturnType<typeof ipcBridge.assistants.get.invoke>>,
  localeKey: string
): string[] => {
  return (
    detail.prompts.recommended_i18n?.[localeKey] ??
    detail.prompts.recommended_i18n?.['en-US'] ??
    detail.prompts.recommended ??
    []
  );
};

/**
 * Manages all assistant editing state and handlers:
 * create, edit, duplicate, save, delete, and toggle enabled.
 */
export const useAssistantEditor = ({
  localeKey,
  activeAssistant,
  isExtensionAssistant,
  setActiveAssistantId,
  loadAssistants,
  refreshAgentDetection,
  message,
}: UseAssistantEditorParams) => {
  const { t } = useTranslation();

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContext, setEditContext] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAgent, setEditAgentState] = useState<string>('claude');
  const [editRecommendedPromptsText, setEditRecommendedPromptsText] = useState('');
  const [defaultModelMode, setDefaultModelMode] = useState<AssistantScalarDefaultMode>('unset');
  const [defaultModelValue, setDefaultModelValue] = useState('');
  const [defaultPermissionMode, setDefaultPermissionMode] = useState<AssistantScalarDefaultMode>('unset');
  const [defaultPermissionValue, setDefaultPermissionValue] = useState('');
  const [defaultSkillsMode, setDefaultSkillsMode] = useState<AssistantSkillsDefaultMode>('fixed');
  const [defaultMcpMode, setDefaultMcpMode] = useState<AssistantMcpDefaultMode>('unset');
  const [availableMcpServers, setAvailableMcpServers] = useState<IMcpServer[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [promptViewMode, setPromptViewMode] = useState<'edit' | 'preview'>('preview');

  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [pendingSkills, setPendingSkills] = useState<PendingSkill[]>([]);
  const [deletePendingSkillName, setDeletePendingSkillName] = useState<string | null>(null);
  const [deleteCustomSkillName, setDeleteCustomSkillName] = useState<string | null>(null);

  const [builtinAutoSkills, setBuiltinAutoSkills] = useState<BuiltinAutoSkill[]>([]);
  const [disabledBuiltinSkills, setDisabledBuiltinSkills] = useState<string[]>([]);

  const loadAssistantDetail = useCallback(
    async (assistantId: string) => ipcBridge.assistants.get.invoke({ id: assistantId, locale: localeKey }),
    [localeKey]
  );

  const refreshAssistantCatalog = useCallback(async () => {
    await Promise.all([loadAssistants(), swrMutate('assistants.list'), swrMutate('assistants')]);
  }, [loadAssistants]);

  const refreshAssistantDetailCaches = useCallback(
    async (assistantId: string | null | undefined) => {
      if (!assistantId) return;
      await swrMutate(`guid.assistant.detail.${assistantId}.${localeKey}`);
    },
    [localeKey]
  );

  const loadEditorResources = useCallback(
    async (assistantId: string) => {
      const [detail, skillsList, autoSkills, mcpServers] = await Promise.all([
        loadAssistantDetail(assistantId),
        ipcBridge.fs.listAvailableSkills.invoke(),
        ipcBridge.fs.listBuiltinAutoSkills.invoke(),
        ipcBridge.mcpService.listServers.invoke(),
      ]);
      return { detail, skillsList, autoSkills, mcpServers };
    },
    [loadAssistantDetail]
  );

  const resetSkillEditorState = useCallback(() => {
    setPendingSkills([]);
    setDeletePendingSkillName(null);
    setDeleteCustomSkillName(null);
    setSelectedSkills([]);
    setCustomSkills([]);
    setDisabledBuiltinSkills([]);
  }, []);

  const resetDefaultConfigState = useCallback(() => {
    setEditRecommendedPromptsText('');
    setDefaultModelMode('unset');
    setDefaultModelValue('');
    setDefaultPermissionMode('unset');
    setDefaultPermissionValue('');
    setDefaultSkillsMode('fixed');
    setDefaultMcpMode('unset');
    setSelectedMcpIds([]);
  }, []);

  const resetModelAndPermissionDefaults = useCallback(() => {
    setDefaultModelMode('unset');
    setDefaultModelValue('');
    setDefaultPermissionMode('unset');
    setDefaultPermissionValue('');
  }, []);

  const setEditAgent = useCallback(
    (nextAgent: string) => {
      if (editAgent === nextAgent) {
        return;
      }

      resetModelAndPermissionDefaults();
      setEditAgentState(nextAgent);
    },
    [editAgent, resetModelAndPermissionDefaults]
  );

  const handleEdit = async (assistant: AssistantListItem) => {
    setIsCreating(false);
    setActiveAssistantId(assistant.id);
    setEditVisible(true);
    setPromptViewMode(assistant.source === 'extension' ? 'preview' : 'edit');
    setEditName(assistant.name || '');
    setEditDescription(assistant.description || '');
    setEditAvatar(assistant.avatar || '');
    setEditAgent(assistant.preset_agent_type || 'claude');
    resetDefaultConfigState();
    resetSkillEditorState();

    try {
      const { detail, skillsList, autoSkills, mcpServers } = await loadEditorResources(assistant.id);
      setEditName(detail.profile.name || assistant.name || '');
      setEditDescription(detail.profile.description || '');
      setEditAvatar(detail.profile.avatar || '');
      setEditAgent(detail.engine.agent_backend || assistant.preset_agent_type || 'claude');
      setEditContext(detail.rules.content || '');
      setEditRecommendedPromptsText(resolveLocalizedRecommendedPrompts(detail, localeKey).join('\n'));
      setDefaultModelMode(
        detail.defaults.model.mode === 'fixed' ? 'fixed' : detail.defaults.model.mode === 'unset' ? 'unset' : 'auto'
      );
      setDefaultModelValue(detail.defaults.model.value || '');
      setDefaultPermissionMode(
        detail.defaults.permission.mode === 'fixed'
          ? 'fixed'
          : detail.defaults.permission.mode === 'unset'
            ? 'unset'
            : 'auto'
      );
      setDefaultPermissionValue(detail.defaults.permission.value || '');
      setDefaultSkillsMode(detail.defaults.skills.mode === 'auto' ? 'auto' : 'fixed');
      setDefaultMcpMode(
        detail.defaults.mcps.mode === 'fixed' ? 'fixed' : detail.defaults.mcps.mode === 'unset' ? 'unset' : 'auto'
      );
      setSelectedMcpIds(detail.defaults.mcps.value ?? []);
      setAvailableSkills(skillsList);
      setBuiltinAutoSkills(autoSkills);
      setAvailableMcpServers(mcpServers);
      setSelectedSkills(detail.capabilities.default_skill_ids ?? []);
      setCustomSkills(isBuiltinAssistant(assistant) ? [] : (detail.capabilities.custom_skill_names ?? []));
      setDisabledBuiltinSkills(detail.capabilities.default_disabled_builtin_skill_ids ?? []);
    } catch (error) {
      console.error('Failed to load assistant detail:', error);
      setEditContext('');
      resetDefaultConfigState();
      setAvailableSkills([]);
      setBuiltinAutoSkills([]);
      setAvailableMcpServers([]);
      resetSkillEditorState();
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setActiveAssistantId(null);
    setEditVisible(true);
    setPromptViewMode('edit');
    setEditName('');
    setEditDescription('');
    setEditContext('');
    setEditAvatar('\u{1F916}');
    setEditAgent('claude');
    resetDefaultConfigState();
    resetSkillEditorState();

    try {
      const [skillsList, autoSkills, mcpServers] = await Promise.all([
        ipcBridge.fs.listAvailableSkills.invoke(),
        ipcBridge.fs.listBuiltinAutoSkills.invoke(),
        ipcBridge.mcpService.listServers.invoke(),
      ]);
      setAvailableSkills(skillsList);
      setBuiltinAutoSkills(autoSkills);
      setAvailableMcpServers(mcpServers);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setAvailableSkills([]);
      setBuiltinAutoSkills([]);
      setAvailableMcpServers([]);
    }
  };

  const handleDuplicate = async (assistant: AssistantListItem) => {
    setIsCreating(true);
    setActiveAssistantId(null);
    setEditVisible(true);
    setPromptViewMode('edit');
    setEditName(`${assistant.name_i18n?.[localeKey] || assistant.name} (Copy)`);
    setEditDescription(assistant.description_i18n?.[localeKey] || assistant.description || '');
    setEditAvatar(assistant.avatar || '\u{1F916}');
    setEditAgent(assistant.preset_agent_type || 'claude');
    resetDefaultConfigState();
    resetSkillEditorState();

    try {
      const { detail, skillsList, autoSkills, mcpServers } = await loadEditorResources(assistant.id);
      setEditContext(detail.rules.content || '');
      setEditRecommendedPromptsText(resolveLocalizedRecommendedPrompts(detail, localeKey).join('\n'));
      setDefaultModelMode(
        detail.defaults.model.mode === 'fixed' ? 'fixed' : detail.defaults.model.mode === 'unset' ? 'unset' : 'auto'
      );
      setDefaultModelValue(detail.defaults.model.value || '');
      setDefaultPermissionMode(
        detail.defaults.permission.mode === 'fixed'
          ? 'fixed'
          : detail.defaults.permission.mode === 'unset'
            ? 'unset'
            : 'auto'
      );
      setDefaultPermissionValue(detail.defaults.permission.value || '');
      setDefaultSkillsMode(detail.defaults.skills.mode === 'auto' ? 'auto' : 'fixed');
      setDefaultMcpMode(
        detail.defaults.mcps.mode === 'fixed' ? 'fixed' : detail.defaults.mcps.mode === 'unset' ? 'unset' : 'auto'
      );
      setSelectedMcpIds(detail.defaults.mcps.value ?? []);
      setAvailableSkills(skillsList);
      setBuiltinAutoSkills(autoSkills);
      setAvailableMcpServers(mcpServers);
      setSelectedSkills(detail.capabilities.default_skill_ids ?? []);
      setCustomSkills(detail.capabilities.custom_skill_names ?? []);
      setDisabledBuiltinSkills(detail.capabilities.default_disabled_builtin_skill_ids ?? []);
    } catch (error) {
      console.error('Failed to load assistant content for duplication:', error);
      setEditContext('');
      resetDefaultConfigState();
      setAvailableSkills([]);
      setBuiltinAutoSkills([]);
      setAvailableMcpServers([]);
      resetSkillEditorState();
    }
  };

  const persistAssistantRules = useCallback(
    async (assistantId: string, rules: string) => {
      const trimmedRules = rules.trim();
      if (trimmedRules) {
        await ipcBridge.fs.writeAssistantRule.invoke({
          assistant_id: assistantId,
          locale: localeKey,
          content: rules,
        });
        return;
      }

      await ipcBridge.fs.deleteAssistantRule.invoke({ assistant_id: assistantId });
    },
    [localeKey]
  );

  const handleSave = async () => {
    try {
      if (!editName.trim()) {
        message.error(t('settings.assistantNameRequired', { defaultValue: 'Assistant name is required' }));
        return;
      }

      if (!isCreating && activeAssistant && isExtensionAssistant(activeAssistant)) {
        message.warning(
          t('settings.extensionAssistantReadonly', {
            defaultValue: 'Extension assistants are read-only. You can duplicate it and edit the copy.',
          })
        );
        return;
      }

      if (defaultModelMode === 'fixed' && !defaultModelValue.trim()) {
        message.error(
          t('settings.assistantDefaultModelRequired', {
            defaultValue: 'Please choose a default model when using a fixed value.',
          })
        );
        return;
      }

      if (defaultPermissionMode === 'fixed' && !defaultPermissionValue.trim()) {
        message.error(
          t('settings.assistantDefaultPermissionRequired', {
            defaultValue: 'Please choose a default permission when using a fixed value.',
          })
        );
        return;
      }

      if (pendingSkills.length > 0) {
        const skillsToImport = pendingSkills.filter(
          (pending) => !availableSkills.some((available) => available.name === pending.name)
        );

        for (const pendingSkill of skillsToImport) {
          try {
            await ipcBridge.fs.importSkillWithSymlink.invoke({ skill_path: pendingSkill.path });
          } catch (error) {
            console.error(`Failed to import skill "${pendingSkill.name}":`, error);
            message.error(t('settings.skillsHub.importError', { defaultValue: 'Error importing skill' }));
            return;
          }
        }

        if (skillsToImport.length > 0) {
          const skillsList = await ipcBridge.fs.listAvailableSkills.invoke();
          setAvailableSkills(skillsList);
        }
      }

      const pendingSkillNames = pendingSkills.map((skill) => skill.name);
      const finalCustomSkills = Array.from(new Set([...customSkills, ...pendingSkillNames]));
      const recommendedPrompts = editRecommendedPromptsText
        .split('\n')
        .map((prompt) => prompt.trim())
        .filter(Boolean);
      const defaults = {
        model:
          defaultModelMode === 'fixed'
            ? { mode: 'fixed', value: defaultModelValue.trim() }
            : { mode: defaultModelMode },
        permission:
          defaultPermissionMode === 'fixed'
            ? { mode: 'fixed', value: defaultPermissionValue.trim() }
            : { mode: defaultPermissionMode },
        skills: { mode: defaultSkillsMode, value: selectedSkills },
        mcps: { mode: defaultMcpMode, value: selectedMcpIds },
      };

      if (isCreating) {
        const createRequest: CreateAssistantRequest = {
          name: editName,
          description: editDescription || undefined,
          avatar: editAvatar || undefined,
          preset_agent_type: editAgent,
          enabled_skills: selectedSkills,
          custom_skill_names: finalCustomSkills,
          disabled_builtin_skills: disabledBuiltinSkills.length > 0 ? disabledBuiltinSkills : undefined,
          recommended_prompts: recommendedPrompts,
          defaults,
        };
        const created = await ipcBridge.assistants.create.invoke(createRequest);
        await persistAssistantRules(created.id, editContext);

        setActiveAssistantId(created.id);
        await refreshAssistantCatalog();
        message.success(t('common.createSuccess', { defaultValue: 'Created successfully' }));
      } else {
        if (!activeAssistant) return;

        const updateRequest: UpdateAssistantRequest = isBuiltinAssistant(activeAssistant)
          ? {
              id: activeAssistant.id,
              preset_agent_type: editAgent,
              defaults: {
                model:
                  defaultModelMode === 'fixed'
                    ? { mode: 'fixed', value: defaultModelValue.trim() }
                    : { mode: defaultModelMode },
                permission:
                  defaultPermissionMode === 'fixed'
                    ? { mode: 'fixed', value: defaultPermissionValue.trim() }
                    : { mode: defaultPermissionMode },
              },
            }
          : {
              id: activeAssistant.id,
              name: editName,
              description: editDescription || undefined,
              avatar: editAvatar || undefined,
              preset_agent_type: editAgent,
              enabled_skills: selectedSkills,
              custom_skill_names: finalCustomSkills,
              disabled_builtin_skills: disabledBuiltinSkills.length > 0 ? disabledBuiltinSkills : undefined,
              recommended_prompts: recommendedPrompts,
              defaults,
            };
        await ipcBridge.assistants.update.invoke(updateRequest);

        if (!isBuiltinAssistant(activeAssistant)) {
          await persistAssistantRules(activeAssistant.id, editContext);
        }

        await refreshAssistantCatalog();
        await refreshAssistantDetailCaches(activeAssistant.id);
        message.success(t('common.saveSuccess', { defaultValue: 'Saved successfully' }));
      }

      setEditVisible(false);
      setPendingSkills([]);
      await refreshAgentDetection();
    } catch (error) {
      console.error('Failed to save assistant:', error);
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  const handleDeleteClick = () => {
    if (!activeAssistant) return;

    if (isBuiltinAssistant(activeAssistant)) {
      message.warning(t('settings.cannotDeleteBuiltin', { defaultValue: 'Cannot delete builtin assistants' }));
      return;
    }

    if (isExtensionAssistant(activeAssistant)) {
      message.warning(
        t('settings.extensionAssistantReadonly', {
          defaultValue: 'Extension assistants are read-only. You can duplicate it and edit the copy.',
        })
      );
      return;
    }

    setDeleteConfirmVisible(true);
  };

  const handleDeleteRequest = (assistant: AssistantListItem) => {
    setActiveAssistantId(assistant.id);

    if (isBuiltinAssistant(assistant)) {
      message.warning(t('settings.cannotDeleteBuiltin', { defaultValue: 'Cannot delete builtin assistants' }));
      return;
    }

    if (isExtensionAssistant(assistant)) {
      message.warning(
        t('settings.extensionAssistantReadonly', {
          defaultValue: 'Extension assistants are read-only. You can duplicate it and edit the copy.',
        })
      );
      return;
    }

    setDeleteConfirmVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeAssistant) return;

    try {
      await ipcBridge.assistants.delete.invoke({ id: activeAssistant.id });
      await refreshAssistantCatalog();
      setDeleteConfirmVisible(false);
      setEditVisible(false);
      message.success(t('common.success', { defaultValue: 'Success' }));
      await refreshAgentDetection();
    } catch (error) {
      console.error('Failed to delete assistant:', error);
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  const handleToggleEnabled = async (assistant: AssistantListItem, enabled: boolean) => {
    if (isExtensionAssistant(assistant)) {
      message.warning(
        t('settings.extensionAssistantReadonly', {
          defaultValue: 'Extension assistants are read-only. You can duplicate it and edit the copy.',
        })
      );
      return;
    }

    try {
      await swrMutate(
        'assistants.list',
        (previousAssistants: Assistant[] | undefined) =>
          previousAssistants?.map((existingAssistant) =>
            existingAssistant.id === assistant.id ? { ...existingAssistant, enabled } : existingAssistant
          ),
        { revalidate: false }
      );
      await ipcBridge.assistants.setState.invoke({ id: assistant.id, enabled });
      await refreshAssistantCatalog();
      await refreshAssistantDetailCaches(assistant.id);
      await refreshAgentDetection();
    } catch (error) {
      console.error('Failed to toggle assistant:', error);
      await Promise.all([swrMutate('assistants.list'), swrMutate('assistants')]);
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  return {
    editVisible,
    setEditVisible,
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editContext,
    setEditContext,
    editAvatar,
    setEditAvatar,
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
    isCreating,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    promptViewMode,
    setPromptViewMode,
    availableSkills,
    setAvailableSkills,
    customSkills,
    setCustomSkills,
    selectedSkills,
    setSelectedSkills,
    pendingSkills,
    setPendingSkills,
    deletePendingSkillName,
    setDeletePendingSkillName,
    deleteCustomSkillName,
    setDeleteCustomSkillName,
    builtinAutoSkills,
    disabledBuiltinSkills,
    setDisabledBuiltinSkills,
    handleEdit,
    handleCreate,
    handleDuplicate,
    handleSave,
    handleDeleteClick,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleToggleEnabled,
  };
};
