import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { actionChainsApi, type ActionChainInput, type OnError, type StepType, type TriggerType } from "../api/actionChains";
import { accountsApi } from "../api/accounts";
import { AppShell } from "../components/common/AppShell";
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
});

export function ActionChainEditorPage() {
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
    <AppShell title="Aktionsketten">
      <label>
          Konto
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedChainId(null);
              setNewChainForm(null);
            }}
          >
            <option value="">– auswählen –</option>
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
              <h2>Ketten</h2>
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
                      {c.name} {!c.is_active && "(pausiert)"}
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setNewChainForm(emptyChainForm(selectedAccountId))}>+ Neue Kette</button>
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
                  <h2>Neue Kette</h2>
                  <label>
                    Name
                    <input
                      value={newChainForm.name}
                      onChange={(e) => setNewChainForm({ ...newChainForm, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Trigger
                    <select
                      value={newChainForm.trigger_type}
                      onChange={(e) => setNewChainForm({ ...newChainForm, trigger_type: e.target.value as TriggerType })}
                    >
                      <option value="unread_new">Neue ungelesene Mail</option>
                      <option value="inbox_zero">Alle Mails gelesen (Inbox Zero)</option>
                    </select>
                  </label>
                  <button type="submit">Anlegen</button>
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
                      Name
                      <input
                        value={chain.name}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { name: e.target.value } })}
                      />
                    </label>
                    <label>
                      Trigger
                      <select
                        value={chain.trigger_type}
                        onChange={(e) =>
                          updateChainMutation.mutate({ id: chain.id, input: { trigger_type: e.target.value as TriggerType } })
                        }
                      >
                        <option value="unread_new">Neue ungelesene Mail</option>
                        <option value="inbox_zero">Alle Mails gelesen (Inbox Zero)</option>
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={chain.is_active}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { is_active: e.target.checked } })}
                      />
                      Aktiv
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={chain.loop_enabled}
                        onChange={(e) => updateChainMutation.mutate({ id: chain.id, input: { loop_enabled: e.target.checked } })}
                      />
                      Kette wiederholen (Loop)
                    </label>
                    {chain.loop_enabled && (
                      <div className="loop-settings">
                        <label>
                          Pause zwischen Wiederholungen (Sekunden)
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
                          Unendlich wiederholen (bis Kette/Konto deaktiviert wird)
                        </label>
                        {!chain.loop_infinite && (
                          <label>
                            Maximale Wiederholungen
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
                          {chain.loop_infinite
                            ? "Die Kette läuft dauerhaft weiter, bis du \"Aktiv\" oder das Konto deaktivierst. Sie bricht zusätzlich vorzeitig ab, sobald das Postfach 0 ungelesene Mails hat."
                            : "Der Loop bricht zusätzlich vorzeitig ab, sobald das Postfach 0 ungelesene Mails hat."}
                        </p>
                      </div>
                    )}
                    <button type="button" onClick={() => deleteChainMutation.mutate(chain.id)}>
                      Kette löschen
                    </button>
                  </form>

                  <h2>Schritte</h2>
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
