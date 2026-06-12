import { Button, Input } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from './editorSectionPrimitives';

type PromptsSectionProps = {
  isBuiltin: boolean;
  recommendedPromptItems: string[];
  addingPrompt: boolean;
  setAddingPrompt: (value: boolean) => void;
  newPromptDraft: string;
  setNewPromptDraft: (value: string) => void;
  editingPromptIndex: number | null;
  setEditingPromptIndex: (value: number | null) => void;
  editingPromptDraft: string;
  setEditingPromptDraft: (value: string) => void;
  onAddPrompt: () => void;
  onBeginPromptEdit: (index: number) => void;
  onSavePromptEdit: () => void;
  onDeletePrompt: (index: number) => void;
  readOnlyLabel: string;
};

const PromptsSection: React.FC<PromptsSectionProps> = ({
  isBuiltin,
  recommendedPromptItems,
  addingPrompt,
  setAddingPrompt,
  newPromptDraft,
  setNewPromptDraft,
  editingPromptIndex,
  setEditingPromptIndex,
  editingPromptDraft,
  setEditingPromptDraft,
  onAddPrompt,
  onBeginPromptEdit,
  onSavePromptEdit,
  onDeletePrompt,
  readOnlyLabel,
}) => {
  const { t } = useTranslation();
  const isPromptEditable = !isBuiltin;
  const showPromptPanel = addingPrompt || recommendedPromptItems.length > 0;

  return (
    <SectionCard
      title={t('settings.assistantRecommendedPromptsLabel', { defaultValue: 'Recommended Prompts' })}
      legend={{
        label: t('settings.assistantEffectiveImmediately', { defaultValue: 'Applies immediately' }),
        tone: 'now',
      }}
      readOnly={isBuiltin}
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
      {showPromptPanel ? (
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
              <Button size='small' type='primary' className='!rounded-full' onClick={onAddPrompt}>
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
                            <Button size='small' type='primary' className='!rounded-full' onClick={onSavePromptEdit}>
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
                                onClick={() => onBeginPromptEdit(index)}
                              >
                                {t('common.edit', { defaultValue: 'Edit' })}
                              </Button>
                              <Button
                                size='small'
                                type='secondary'
                                className='!rounded-full'
                                onClick={() => onDeletePrompt(index)}
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
      ) : null}
    </SectionCard>
  );
};

export default PromptsSection;
