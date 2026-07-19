import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { printersApi, type Printer } from "../api/printers";
import { AppShell } from "../components/common/AppShell";
import { SetupWizard } from "../components/printer-wizard/SetupWizard";
import { PrinterEditForm } from "../components/printer-wizard/PrinterEditForm";

export function PrintersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: printers } = useQuery({ queryKey: ["printers"], queryFn: printersApi.list });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);

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
    <AppShell title={t("nav.printers")}>
      {editing ? (
          <PrinterEditForm
            printer={editing}
            onSaved={() => {
              setEditing(null);
              queryClient.invalidateQueries({ queryKey: ["printers"] });
            }}
            onCancel={() => setEditing(null)}
          />
        ) : wizardOpen ? (
          <SetupWizard
            onCreated={() => {
              setWizardOpen(false);
              queryClient.invalidateQueries({ queryKey: ["printers"] });
            }}
            onCancel={() => setWizardOpen(false)}
          />
        ) : (
          <div className="page-actions">
            <button onClick={() => setWizardOpen(true)}>{t("printers.setupPrinter")}</button>
          </div>
        )}

        <h2>{t("printers.printersHeading")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("printers.name")}</th>
              <th>{t("printers.duplex")}</th>
              <th>{t("printers.color")}</th>
              <th>{t("printers.active")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {printers?.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.capabilities.duplex_supported ? t("common.yes") : t("common.no")}</td>
                <td>{p.capabilities.color_supported ? t("common.yes") : t("common.no")}</td>
                <td>{p.is_active ? t("common.yes") : t("common.no")}</td>
                <td>
                  <button onClick={() => testMutation.mutate(p.id)}>{t("printers.testPrint")}</button>
                  <button onClick={() => setEditing(p)}>{t("common.edit")}</button>
                  <button onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                    {p.is_active ? t("printers.deactivate") : t("printers.activate")}
                  </button>
                  <button onClick={() => deleteMutation.mutate(p.id)}>{t("common.delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
