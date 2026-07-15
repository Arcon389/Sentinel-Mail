import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { printersApi } from "../api/printers";
import { AppShell } from "../components/common/AppShell";
import { SetupWizard } from "../components/printer-wizard/SetupWizard";

export function PrintersPage() {
  const queryClient = useQueryClient();
  const { data: printers } = useQuery({ queryKey: ["printers"], queryFn: printersApi.list });
  const [wizardOpen, setWizardOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: printersApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printers"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => printersApi.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printers"] }),
  });

  const testMutation = useMutation({ mutationFn: printersApi.testPrint });

  return (
    <AppShell title="Drucker">
      {wizardOpen ? (
          <SetupWizard
            onCreated={() => {
              setWizardOpen(false);
              queryClient.invalidateQueries({ queryKey: ["printers"] });
            }}
            onCancel={() => setWizardOpen(false)}
          />
        ) : (
          <button onClick={() => setWizardOpen(true)}>+ Drucker einrichten</button>
        )}

        <h2>Drucker</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Duplex</th>
              <th>Farbe</th>
              <th>Aktiv</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {printers?.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.capabilities.duplex_supported ? "ja" : "nein"}</td>
                <td>{p.capabilities.color_supported ? "ja" : "nein"}</td>
                <td>{p.is_active ? "ja" : "nein"}</td>
                <td>
                  <button onClick={() => testMutation.mutate(p.id)}>Testdruck</button>
                  <button onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                    {p.is_active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                  <button onClick={() => deleteMutation.mutate(p.id)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
