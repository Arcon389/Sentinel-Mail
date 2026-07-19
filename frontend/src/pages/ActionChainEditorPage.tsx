import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { actionChainsApi, type ActionChainInput, type OnError, type StepType, type TriggerType } from "../api/actionChains";
import { accountsApi } from "../api/accounts";
import { AppShell } from "../components/common/AppShell";
import { useConfirm } from "../components/common/ConfirmDialog";
import { StepList } from "../components/chain-editor/StepList";
import { StepTypeSelector } from "../components/chain-editor/StepTypeSelector";
import { defaultConfigFor } from "../components/chain-editor/defaultConfigs";

const emptyChainForm = (accountId: string): ActionChainInput => ({
  account_id: accountId,
  name: "",
  trigger_type: "unread_new",
  is_active: true,
  loop_enabled: false,
  loop_pause_seconds: 0,
  loop_max_iterations: 1,
  loop_infinite: false,
  time_window_enabled: false,
  time_start: null,
  time_end: null,
  condition_match: "all",
  sender_filter_mode: "contains",
  sender_filter: null,
  subject_regex: null,
  body_regex: null,
});

export function ActionChainEditorPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [newChainForm, setNewChainForm] = useState<ActionChainInput | null>(null);

  const { data: chains } = useQuery({
    queryKey: ["action-chains", selectedAccountId],
    queryFn: () => actionChainsApi.list(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const { data: chain } = useQuery({
    queryKey: ["action-chain", selectedChainId],
    queryFn: () => actionChainsApi.get(selectedChainId!),
    enabled: !!selectedChainId,
  });

  const invalidateChain = () => {
    queryClient.invalidateQueries({ queryKey: ["action-chain", selectedChainId] });
    queryClient.invalidateQueries({ queryKey: ["action-chains", selectedAccountId] });
  };

  const createChainMutation = useMutation({
    mutationFn: actionChainsApi.create,
    onSuccess: (created) => {
      setNewChainForm(null);
      setSelectedChainId(created.id);
      queryClient.invalidateQueries({ queryKey: ["action-chains", selectedAccountId] });
    },
  });

  const updateChainMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ActionChainInput> }) => actionChainsApi.update(id, input),
    onSuccess: invalidateChain,
  });

  const deleteChainMutation = useMutation({
    mutationFn: actionChainsApi.remove,
    onSuccess: () => {
      setSelectedChainId(null);
      queryClient.invalidateQueries({ queryKey: ["action-chains", selectedAccountId] });
    },
  });

  const addStepMutation = useMutation({
    mutationFn: ({ chainId, stepType }: { chainId: string; stepType: StepType }) =>
      actionChainsApi.addStep(chainId, { step_type: stepType, config: defaultConfigFor(stepType), on_error: "abort_chain" }),
    onSuccess: invalidateChain,
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ chainId, stepId, config }: { chainId: string; stepId: string; config: unknown }) =>
      actionChainsApi.updateStep(chainId, stepId, { config }),
    onSuccess: invalidateChain,
  });

  const updateStepErrorMutation = useMutation({
    mutationFn: ({ chainId, stepId, onError }: { chainId: string; stepId: string; onError: OnError }) =>
      actionChainsApi.updateStep(chainId, stepId, { on_error: onError }),
    onSuccess: invalidateChain,
  });

  const deleteStepMutation = useMutation({
    mutationFn: ({ chainId, stepId }: { chainId: string; stepId: string }) => actionChainsApi.removeStep(chainId, stepId),
    onSuccess: invalidateChain,
  });

  const reorderStepsMutation = useMutation({
    mutationFn: ({ chainId, stepIds }: { chainId: string; stepIds: string[] }) => actionChainsApi.reorderSteps(chainId, stepIds),
    onSuccess: invalidateChain,
  });

  return (
    <AppShell title={t("nav.chains")}>
      <label>
          {t("chains.account")}
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedChainId(null);
              setNewChainForm(null);
            }}
          >
            <option value="">{t("common.select")}</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        {selectedAccountId && (
          <div className="chain-layout">
            <aside className="chain-list">
              <h2>{t("chains.chainsHeading")}</h2>
              <ul>
                {chains?.map((c) => (
                  <li key={c.id}>
                    <button
                      className={c.id === selectedChainId ? "active" : ""}
                      onClick={() => {
                        setSelectedChainId(c.id);
                        setNewChainForm(null);
                      }}
                    >
                      {c.name} {!c.is_active && t("chains.paused")}
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setNewChainForm(emptyChainForm(selectedAccountId))}>{t("chains.newChain")}</button>
            </aside>

            <section className="chain-detail">
              {newChainForm && (
                <form
                  className="chain-meta-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createChainMutation.mutate(newChainForm);
                  }}
                >
                  <h2>{t("chains.newChainTitle")}</h2>
                  <label>
                    {t("chains.name")}
                    <input
                      value={newChainForm.name}
                      onChange={(e) => setNewChainForm({ ...newChainForm, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    {t("chains.trigger")}
                    <select
                      value={newChainForm.trigger_type}
                      onChange={(e) => setNewChainForm({ ...newChainForm, trigger_type: e.target.value as TriggerType })}
                    >
                      <option value="unread_new">{t("common.triggerUnread")}</option>
                      <option value="inbox_zero">{t("common.triggerInboxZero")}</option>
                    </select>
                  </label>
                  <button type="submit">{t("common.create")}</button>
                </form>
              )}

              {chain && !newChainForm && (
                <>
                  <form
                    className="chain-meta-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <h2>{chain.name}</h2>
                    <label>
                      {t("chains.name")}
                      <input
                        value={chain.name}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { name: e.target.value } })}
                      />
                    </label>
                    <label>
                      {t("chains.trigger")}
                      <select
                        value={chain.trigger_type}
                        onChange={(e) =>
                          updateChainMutation.mutate({ id: chain.id, input: { trigger_type: e.target.value as TriggerType } })
                        }
                      >
                        <option value="unread_new">{t("common.triggerUnread")}</option>
                        <option value="inbox_zero">{t("common.triggerInboxZero")}</option>
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={chain.is_active}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { is_active: e.target.checked } })}
                      />
                      {t("chains.active")}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={chain.loop_enabled}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { loop_enabled: e.target.checked } })}
                      />
                      {t("chains.loopEnable")}
                    </label>
                    {chain.loop_enabled && (
                      <div className="loop-settings">
                        <label>
                          {t("chains.loopPause")}
                          <input
                            type="number"
                            min={0}
                            value={chain.loop_pause_seconds}
                            onChange={(e) =>
                              updateChainMutation.mutate({ id: chain.id, input: { loop_pause_seconds: Number(e.target.value) } })
                            }
                          />
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={chain.loop_infinite}
                            onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { loop_infinite: e.target.checked } })}
                          />
                          {t("chains.loopInfinite")}
                        </label>
                        {!chain.loop_infinite && (
                          <label>
                            {t("chains.loopMax")}
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              value={chain.loop_max_iterations}
                              onChange={(e) =>
                                updateChainMutation.mutate({ id: chain.id, input: { loop_max_iterations: Number(e.target.value) } })
                              }
                            />
                          </label>
                        )}
                        <p className="hint">
                          {chain.loop_infinite ? t("chains.loopHintInfinite") : t("chains.loopHintFinite")}
                        </p>
                      </div>
                    )}
                    <label>
                      <input
                        type="checkbox"
                        checked={chain.time_window_enabled}
                        onChange={(e) =>
                          updateChainMutation.mutate({ id: chain.id, input: { time_window_enabled: e.target.checked } })
                        }
                      />
                      {t("chains.timeWindowEnable")}
                    </label>
                    {chain.time_window_enabled && (
                      <div className="loop-settings">
                        <label>
                          {t("chains.timeFrom")}
                          <input
                            type="time"
                            value={chain.time_start ?? ""}
                            onChange={(e) =>
                              updateChainMutation.mutate({ id: chain.id, input: { time_start: e.target.value || null } })
                            }
                          />
                        </label>
                        <label>
                          {t("chains.timeTo")}
                          <input
                            type="time"
                            value={chain.time_end ?? ""}
                            onChange={(e) =>
                              updateChainMutation.mutate({ id: chain.id, input: { time_end: e.target.value || null } })
                            }
                          />
                        </label>
                        <p className="hint">
                          <Trans i18nKey="chains.timeHint" components={{ code: <code /> }} />
                        </p>
                      </div>
                    )}

                    <label>
                      {t("chains.conditionMatch")}
                      <select
                        value={chain.condition_match}
                        onChange={(e) =>
                          updateChainMutation.mutate({
                            id: chain.id,
                            input: { condition_match: e.target.value as "all" | "any" },
                          })
                        }
                      >
                        <option value="all">{t("chains.conditionAll")}</option>
                        <option value="any">{t("chains.conditionAny")}</option>
                      </select>
                    </label>
                    <div className="loop-settings">
                      <label>
                        {t("chains.sender")}
                        <input
                          value={chain.sender_filter ?? ""}
                          placeholder={t("chains.senderPlaceholder")}
                          onChange={(e) =>
                            updateChainMutation.mutate({ id: chain.id, input: { sender_filter: e.target.value || null } })
                          }
                        />
                      </label>
                      <label>
                        {t("chains.senderMode")}
                        <select
                          value={chain.sender_filter_mode}
                          onChange={(e) =>
                            updateChainMutation.mutate({
                              id: chain.id,
                              input: { sender_filter_mode: e.target.value as "contains" | "regex" },
                            })
                          }
                        >
                          <option value="contains">{t("chains.senderContains")}</option>
                          <option value="regex">{t("chains.senderRegex")}</option>
                        </select>
                      </label>
                      <label>
                        {t("chains.subjectRegex")}
                        <input
                          value={chain.subject_regex ?? ""}
                          placeholder={t("chains.subjectPlaceholder")}
                          onChange={(e) =>
                            updateChainMutation.mutate({ id: chain.id, input: { subject_regex: e.target.value || null } })
                          }
                        />
                      </label>
                      <label>
                        {t("chains.bodyRegex")}
                        <input
                          value={chain.body_regex ?? ""}
                          placeholder={t("chains.bodyPlaceholder")}
                          onChange={(e) =>
                            updateChainMutation.mutate({ id: chain.id, input: { body_regex: e.target.value || null } })
                          }
                        />
                      </label>
                      <p className="hint">{t("chains.conditionsHint")}</p>
                    </div>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={async () => {
                        if (
                          await confirm({
                            message: t("chains.deleteChainConfirm", { name: chain.name }),
                            confirmLabel: t("chains.deleteChain"),
                            danger: true,
                          })
                        ) {
                          deleteChainMutation.mutate(chain.id);
                        }
                      }}
                    >
                      {t("chains.deleteChain")}
                    </button>
                  </form>

                  <h2>{t("chains.stepsHeading")}</h2>
                  <StepList
                    steps={chain.steps}
                    accountId={chain.account_id}
                    onReorder={(stepIds) => reorderStepsMutation.mutate({ chainId: chain.id, stepIds })}
                    onStepChange={(stepId, config) => updateStepMutation.mutate({ chainId: chain.id, stepId, config })}
                    onStepErrorChange={(stepId, onError) => updateStepErrorMutation.mutate({ chainId: chain.id, stepId, onError })}
                    onStepDelete={(stepId) => deleteStepMutation.mutate({ chainId: chain.id, stepId })}
                  />
                  <StepTypeSelector onAdd={(stepType) => addStepMutation.mutate({ chainId: chain.id, stepType })} />
                </>
              )}
            </section>
          </div>
        )}
    </AppShell>
  );
}
