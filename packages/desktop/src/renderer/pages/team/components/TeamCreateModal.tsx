import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Form, Input, Message } from '@arco-design/web-react';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';
import { Close, Search, Flag } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import type { TTeam, TeamAgent } from '@/common/types/team/teamTypes';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useConversationAgents } from '@renderer/pages/conversation/hooks/useConversationAgents';
import AionModal from '@renderer/components/base/AionModal';
import { WorkspaceFolderSelect } from '@renderer/components/workspace';
import {
  agentKey,
  agentFromKey,
  resolveConversationType,
  resolveTeamAgentType,
  filterTeamSupportedAgents,
  AgentOptionLabel,
  cliAgentToOption,
  assistantToOption,
} from './agentSelectUtils';
import { resolveDefaultTeamAgentModel } from './teamCreateModelResolver';
import type { TeamAgentOption } from './agentSelectUtils';

// [E2E SYNC] 修改此组件的 DOM 结构（class、标题、关闭按钮等）时，
// 必须同步更新 tests/e2e/cases/teams/team-create.e2e.ts 和 team-whitelist.e2e.ts 中的 selector，
// 并立即向上汇报改动情况。
const FormItem = Form.Item;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (team: TTeam) => void;
};

const AgentListItem: React.FC<{
  agent: TeamAgentOption;
  isSelected: boolean;
  onClick: () => void;
}> = ({ agent, isSelected, onClick }) => (
  <div
    className={`flex cursor-pointer items-center gap-10px rounded-10px px-12px py-10px transition-colors ${
      isSelected ? 'bg-fill-2' : 'hover:bg-fill-1'
    }`}
    onClick={onClick}
    data-testid={`team-create-agent-option-${agentKey(agent)}`}
  >
    <div className='flex-1 overflow-hidden'>
      <AgentOptionLabel agent={agent} />
    </div>
    <div
      className={`flex h-20px w-20px flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        isSelected
          ? 'border-primary-6 bg-primary-6'
          : 'border-border-2 bg-transparent'
      }`}
    >
      {isSelected && (
        <svg width='10' height='8' viewBox='0 0 10 8' fill='none'>
          <path d='M1 4L3.5 6.5L9 1' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      )}
    </div>
  </div>
);

const TeamCreateModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { cliAgents, presetAssistants } = useConversationAgents();
  const [name, setName] = useState('');
  const [leaderKey, setLeaderKey] = useState<string | undefined>(undefined);
  const [workspace, setWorkspace] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const nameInputRef = useRef<RefInputType | null>(null);

  const cliAgentOptions = useMemo(() => cliAgents.map(cliAgentToOption), [cliAgents]);
  const teamCapableKeys = useMemo(
    () =>
      new Set(cliAgents.filter((a) => a.team_capable).flatMap((a) => [a.id, a.backend].filter(Boolean) as string[])),
    [cliAgents]
  );
  const presetAssistantOptions = useMemo(
    () => presetAssistants.map((a) => assistantToOption(a, teamCapableKeys)),
    [presetAssistants, teamCapableKeys]
  );
  const allAgents = filterTeamSupportedAgents([...cliAgentOptions, ...presetAssistantOptions]);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return allAgents;
    const q = search.toLowerCase();
    return allAgents.filter((a) => a.name.toLowerCase().includes(q));
  }, [allAgents, search]);

  const { filteredCliAgents, filteredPresetAssistants } = useMemo(() => {
    const cliKeys = new Set(cliAgentOptions.map(agentKey));
    return {
      filteredCliAgents: filteredAgents.filter((a) => cliKeys.has(agentKey(a))),
      filteredPresetAssistants: filteredAgents.filter((a) => !cliKeys.has(agentKey(a))),
    };
  }, [filteredAgents, cliAgentOptions]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [visible]);

  const handleClose = () => {
    setName('');
    setLeaderKey(undefined);
    setWorkspace('');
    setSearch('');
    onClose();
  };

  const handleToggleAgent = (key: string) => {
    setLeaderKey((prev) => (prev === key ? undefined : key));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Message.warning(t('team.create.nameRequired', { defaultValue: 'Please enter a team name' }));
      nameInputRef.current?.focus();
      return;
    }
    if (!leaderKey) {
      Message.warning(t('team.create.leaderRequired', { defaultValue: 'Please select a team leader' }));
      return;
    }
    const user_id = user?.id ?? 'system_default_user';
    setLoading(true);
    try {
      const agents: TeamAgent[] = [];

      const leaderAgent = agentFromKey(leaderKey, allAgents);
      const leaderAgentType = resolveTeamAgentType(leaderAgent, 'acp');
      const leaderConversationType = resolveConversationType(leaderAgentType);
      const resolvedModel = await resolveDefaultTeamAgentModel({
        agent_type: leaderAgentType,
        conversation_type: leaderConversationType,
      });
      agents.push({
        slot_id: '',
        conversation_id: '',
        role: 'leader',
        status: 'pending',
        agent_type: leaderAgentType,
        agent_name: 'Leader',
        conversation_type: leaderConversationType,
        custom_agent_id: leaderAgent?.id,
        model: resolvedModel,
      });

      const team = await ipcBridge.team.create.invoke({
        user_id,
        name,
        workspace,
        workspace_mode: 'shared',
        agents,
      });

      const result = team as unknown as { __bridgeError?: boolean; message?: string };
      if (result.__bridgeError) {
        Message.error(result.message ?? t('team.create.error', { defaultValue: 'Failed to create team' }));
        return;
      }

      onCreated(team);
      handleClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Message.error(msg || t('team.create.error', { defaultValue: 'Failed to create team' }));
    } finally {
      setLoading(false);
    }
  };

  const selectedLeader = leaderKey ? agentFromKey(leaderKey, allAgents) : undefined;

  return (
    <AionModal
      visible={visible}
      onCancel={handleClose}
      className='team-create-modal'
      style={{ width: 720 }}
      wrapStyle={{ zIndex: 10000 }}
      maskStyle={{ zIndex: 9999 }}
      autoFocus={false}
      unmountOnExit={false}
      contentStyle={{
        background: 'var(--dialog-fill-0)',
        padding: 0,
        overflow: 'hidden',
      }}
      header={{
        render: () => (
          <div className='flex items-center justify-between border-b border-border-1 bg-dialog-fill-0 px-24px py-18px'>
            <div>
              <h3 className='m-0 text-16px font-600 text-t-primary'>
                {t('team.create.title', { defaultValue: 'Create Team' })}
              </h3>
              <p className='m-0 mt-2px text-12px text-t-tertiary'>
                {t('team.create.subtitle', { defaultValue: 'Choose a leader agent to coordinate your team' })}
              </p>
            </div>
            <Button
              type='text'
              icon={<Close size='18' fill='currentColor' className='text-t-secondary' />}
              onClick={handleClose}
              className='!h-28px !w-28px !min-w-28px !p-0 !rd-8px hover:!bg-fill-1'
            />
          </div>
        ),
      }}
      footer={
        <div className='flex justify-end gap-10px border-t border-border-1 bg-dialog-fill-0 px-24px py-16px'>
          <Button onClick={handleClose} className='min-w-80px' style={{ borderRadius: 8 }}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type='primary'
            onClick={handleCreate}
            loading={loading}
            disabled={!name.trim() || !leaderKey}
            className='min-w-80px'
            style={{ borderRadius: 8 }}
          >
            {t('team.create.confirm', { defaultValue: 'Create Team' })}
          </Button>
        </div>
      }
    >
      {/* 左右分栏 */}
      <div className='flex' style={{ height: 440 }}>
        {/* 左侧：Agent 列表 */}
        <div className='flex flex-col border-r border-border-1' style={{ width: 320, flexShrink: 0 }}>
          {/* 搜索框 */}
          <div className='px-12px pt-12px pb-8px'>
            <div className='flex items-center gap-8px rounded-8px bg-fill-1 px-10px py-7px'>
              <Search size='14' fill='currentColor' className='flex-shrink-0 text-t-tertiary' />
              <input
                className='flex-1 border-none bg-transparent text-13px text-t-primary outline-none placeholder:text-t-tertiary'
                placeholder={t('team.create.searchPlaceholder', { defaultValue: 'Search agents...' })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Agent 列表 */}
          <div className='flex-1 overflow-y-auto px-8px pb-8px'>
            {allAgents.length === 0 ? (
              <div className='flex h-full items-center justify-center text-12px text-t-tertiary'>
                {t('team.create.noSupportedAgents', { defaultValue: 'No supported agents installed' })}
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className='flex h-full items-center justify-center text-12px text-t-tertiary'>
                {t('team.create.noSearchResults', { defaultValue: 'No results found' })}
              </div>
            ) : (
              <>
                {filteredCliAgents.length > 0 && (
                  <div>
                    <div className='px-12px py-6px text-11px font-500 uppercase tracking-wider text-t-tertiary'>
                      {t('conversation.dropdown.cliAgents', { defaultValue: 'CLI Agents' })}
                    </div>
                    {filteredCliAgents.map((agent) => {
                      const key = agentKey(agent);
                      return (
                        <AgentListItem
                          key={key}
                          agent={agent}
                          isSelected={leaderKey === key}
                          onClick={() => handleToggleAgent(key)}
                        />
                      );
                    })}
                  </div>
                )}
                {filteredPresetAssistants.length > 0 && (
                  <div className={filteredCliAgents.length > 0 ? 'mt-4px' : ''}>
                    <div className='px-12px py-6px text-11px font-500 uppercase tracking-wider text-t-tertiary'>
                      {t('conversation.dropdown.presetAssistants', { defaultValue: 'Preset Assistants' })}
                    </div>
                    {filteredPresetAssistants.map((agent) => {
                      const key = agentKey(agent);
                      return (
                        <AgentListItem
                          key={key}
                          agent={agent}
                          isSelected={leaderKey === key}
                          onClick={() => handleToggleAgent(key)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 右侧：已选 Leader + 表单 */}
        <div className='flex flex-1 flex-col overflow-y-auto'>
          {/* 已选 Leader 区域 */}
          <div className='border-b border-border-1 px-20px py-14px'>
            <div className='mb-8px flex items-center justify-between'>
              <span className='text-12px font-500 text-t-secondary'>
                {t('team.create.step.dispatch', { defaultValue: 'Team Leader' })}
              </span>
              {selectedLeader && (
                <span className='flex items-center gap-4px text-11px text-primary-6'>
                  <Flag size='12' fill='currentColor' />
                  {t('team.create.leaderSelected', { defaultValue: 'Selected' })}
                </span>
              )}
            </div>

            {selectedLeader ? (
              <div className='flex items-center justify-between rounded-10px border border-border-1 bg-fill-1 px-12px py-10px'>
                <AgentOptionLabel agent={selectedLeader} />
                <Button
                  type='text'
                  icon={<Close size='14' fill='currentColor' />}
                  onClick={() => setLeaderKey(undefined)}
                  className='!h-20px !w-20px !min-w-20px !p-0 !rd-6px text-t-tertiary hover:!bg-fill-2 hover:!text-t-secondary'
                />
              </div>
            ) : (
              <div className='flex items-center justify-center rounded-10px border border-dashed border-border-2 py-16px text-12px text-t-tertiary'>
                {t('team.create.leaderDesc', { defaultValue: 'Select a leader from the left' })}
              </div>
            )}
          </div>

          {/* 表单区域 */}
          <div className='flex-1 px-20px py-16px'>
            <Form layout='vertical'>
              <FormItem
                label={
                  <span className='text-12px font-500 text-t-secondary'>
                    {t('team.create.namePlaceholder', { defaultValue: 'Team name' })}
                    <span className='ml-4px text-danger-6'>*</span>
                  </span>
                }
              >
                <Input
                  ref={nameInputRef}
                  placeholder={t('team.create.namePlaceholder', { defaultValue: 'Team name' })}
                  value={name}
                  onChange={setName}
                  data-testid='team-create-name-input'
                />
              </FormItem>

              <FormItem
                label={
                  <span className='text-12px font-500 text-t-secondary'>
                    {t('team.create.step.workspace', { defaultValue: 'Project' })}
                    <span className='ml-4px text-11px font-normal text-t-tertiary'>
                      {t('common.optional', { defaultValue: '(optional)' })}
                    </span>
                  </span>
                }
              >
                <WorkspaceFolderSelect
                  value={workspace}
                  onChange={setWorkspace}
                  placeholder={t('team.create.selectFolder', { defaultValue: 'Select folder' })}
                  input_placeholder={t('team.create.workspacePlaceholder', {
                    defaultValue: 'Project folder path (optional)',
                  })}
                  recentLabel={t('team.create.recentLabel', { defaultValue: 'Recent' })}
                  chooseDifferentLabel={t('team.create.chooseDifferentFolder', {
                    defaultValue: 'Choose a different folder',
                  })}
                  triggerTestId='team-create-workspace-trigger'
                  menuTestId='team-create-workspace-menu'
                />
              </FormItem>
            </Form>
          </div>
        </div>
      </div>
    </AionModal>
  );
};

export default TeamCreateModal;
