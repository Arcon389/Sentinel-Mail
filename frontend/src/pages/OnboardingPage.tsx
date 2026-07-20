import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { type Account, type AccountInput, accountsApi } from "../api/accounts";
import { type ActionChainInput, type TriggerType, actionChainsApi } from "../api/actionChains";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { systemApi } from "../api/system";
import { useAuth } from "../auth/AuthContext";
import { SetupWizard as PrinterSetupWizard } from "../components/printer-wizard/SetupWizard";

const STEP_KEYS = [
  "onboarding.stepWelcome",
  "onboarding.stepImap",
  "onboarding.stepSmtp",
  "onboarding.stepPrinter",
  "onboarding.stepChain",
  "onboarding.stepDone",
] as const;

const emptyAccount: AccountInput = {
  name: "",
  imap_host: "",
  imap_port: 993,
  use_ssl: true,
  username: "",
  password: "",
  folder: "INBOX",
  poll_interval_seconds: null,
  use_idle: null,
  is_active: true,
  sender_list: null,
  sender_list_mode: "off",
};

function chainDefaults(accountId: string, name: string, trigger: TriggerType): ActionChainInput {
  return {
    account_id: accountId,
    name,
    trigger_type: trigger,
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
  };
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    setFinishing(true);
    try {
      await authApi.completeOnboarding();
    } finally {
      await refresh();
      navigate("/");
    }
  };

  return (
    <div className="auth-page">
      <div className="printer-wizard onboarding">
        <div className="onboarding-steps">
          {STEP_KEYS.map((labelKey, i) => (
            <span key={labelKey} className={"onboarding-step" + (i === step ? " active" : i < step ? " done" : "")}>
              {t("onboarding.stepLabel", { index: i + 1, label: t(labelKey) })}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="wizard-step">
            <h2>{t("onboarding.welcomeTitle")}</h2>
            <p>{t("onboarding.welcomeText")}</p>
            <div className="button-row">
              <button type="button" onClick={() => setStep(1)}>
                {t("onboarding.start")}
              </button>
              <button type="button" onClick={finish} disabled={finishing}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        )}

        {step === 1 && <ImapStep onDone={() => setStep(2)} onSkip={() => setStep(2)} onFinish={finish} finishing={finishing} />}

        {step === 2 && <SmtpStep onNext={() => setStep(3)} onFinish={finish} finishing={finishing} />}

        {step === 3 && (
          <div className="wizard-step">
            <p className="hint">{t("onboarding.printerOptionalHint")}</p>
            <PrinterSetupWizard onCreated={() => setStep(4)} onCancel={() => setStep(4)} />
            <div className="button-row">
              <button type="button" onClick={finish} disabled={finishing}>
                {t("onboarding.skipOnboarding")}
              </button>
            </div>
          </div>
        )}

        {step === 4 && <ChainStep onNext={() => setStep(5)} onSkip={() => setStep(5)} onFinish={finish} finishing={finishing} />}

        {step === 5 && (
          <div className="wizard-step">
            <h2>{t("onboarding.finishTitle")}</h2>
            <p>{t("onboarding.finishText")}</p>
            <div className="button-row">
              <button type="button" onClick={finish} disabled={finishing}>
                {t("onboarding.toDashboard")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepProps {
  onFinish: () => void;
  finishing: boolean;
}

function ImapStep({ onDone, onSkip, onFinish, finishing }: StepProps & { onDone: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const { data: defaults } = useQuery({ queryKey: ["account-defaults"], queryFn: accountsApi.defaults });
  const [form, setForm] = useState<AccountInput>(emptyAccount);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onTest = async () => {
    setTestResult(t("accounts.testing"));
    try {
      const result = await accountsApi.testNew(form);
      setTestResult(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch (err) {
      setTestResult(err instanceof ApiError ? `✗ ${err.message}` : `✗ ${t("accounts.testFailed")}`);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const account = await accountsApi.create(form);
      // Remember the created account id for the action-chain step.
      sessionStorage.setItem("onboarding_account_id", account.id);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("onboarding.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="wizard-step" onSubmit={onSubmit}>
      <h2>{t("onboarding.imapTitle")}</h2>
      <label>
        {t("accounts.name")}
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </label>
      <label>
        {t("accounts.imapHost")}
        <input value={form.imap_host} onChange={(e) => setForm({ ...form, imap_host: e.target.value })} required />
      </label>
      <label>
        {t("accounts.port")}
        <input
          type="number"
          value={form.imap_port}
          onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })}
          required
        />
      </label>
      <label>
        <input type="checkbox" checked={form.use_ssl} onChange={(e) => setForm({ ...form, use_ssl: e.target.checked })} />
        {t("accounts.ssl")}
      </label>
      <label>
        {t("accounts.username")}
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      </label>
      <label>
        {t("accounts.password")}
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
      </label>
      <label>
        {t("accounts.folder")}
        <input value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} required />
      </label>
      <label>
        {t("accounts.pollInterval")}
        <input
          type="number"
          min={5}
          placeholder={
            defaults
              ? t("onboarding.pollPlaceholderGlobalShort", { seconds: defaults.default_poll_interval_seconds })
              : t("accounts.pollPlaceholderGlobal")
          }
          value={form.poll_interval_seconds ?? ""}
          onChange={(e) =>
            setForm({ ...form, poll_interval_seconds: e.target.value ? Number(e.target.value) : null })
          }
        />
      </label>
      {error && <p className="error">{error}</p>}
      {testResult && <p>{testResult}</p>}
      <div className="button-row">
        <button type="button" onClick={onTest}>
          {t("accounts.testConnection")}
        </button>
        <button type="submit" disabled={saving}>
          {saving ? t("onboarding.saving") : t("onboarding.createAndNext")}
        </button>
        <button type="button" onClick={onSkip}>
          {t("common.skip")}
        </button>
        <button type="button" onClick={onFinish} disabled={finishing}>
          {t("onboarding.finishOnboarding")}
        </button>
      </div>
    </form>
  );
}

function SmtpStep({ onNext, onFinish, finishing }: StepProps & { onNext: () => void }) {
  const { t } = useTranslation();
  const { data: status } = useQuery({ queryKey: ["smtp-status"], queryFn: systemApi.smtpStatus });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const onTest = async () => {
    setTesting(true);
    setTestResult(t("onboarding.sendingTestmail"));
    try {
      const result = await systemApi.smtpTest();
      setTestResult(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch (err) {
      setTestResult(err instanceof ApiError ? `✗ ${err.message}` : `✗ ${t("onboarding.testFailed")}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="wizard-step">
      <h2>{t("onboarding.smtpTitle")}</h2>
      {status?.configured ? (
        <>
          <p>
            <Trans i18nKey="onboarding.smtpConfigured" values={{ host: status.host }} components={{ code: <code /> }} />
          </p>
          <button type="button" onClick={onTest} disabled={testing}>
            {t("onboarding.sendTestmail")}
          </button>
          {testResult && <p>{testResult}</p>}
        </>
      ) : (
        <p className="hint">
          <Trans i18nKey="onboarding.smtpNotConfigured" components={{ code: <code /> }} />
        </p>
      )}
      <div className="button-row">
        <button type="button" onClick={onNext}>
          {t("common.next")}
        </button>
        <button type="button" onClick={onFinish} disabled={finishing}>
          {t("onboarding.finishOnboarding")}
        </button>
      </div>
    </div>
  );
}

function ChainStep({ onNext, onSkip, onFinish, finishing }: StepProps & { onNext: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const storedId = sessionStorage.getItem("onboarding_account_id");
  const [accountId, setAccountId] = useState<string>(storedId ?? "");
  const [name, setName] = useState(() => t("onboarding.chainNameDefault"));
  const [trigger, setTrigger] = useState<TriggerType>("unread_new");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  const effectiveAccountId = accountId || (accounts && accounts.length > 0 ? accounts[0].id : "");

  const onCreate = async () => {
    if (!effectiveAccountId) return;
    setError(null);
    setSaving(true);
    try {
      await actionChainsApi.create(chainDefaults(effectiveAccountId, name, trigger));
      setCreated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("onboarding.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const hasAccounts = (accounts?.length ?? 0) > 0;

  return (
    <div className="wizard-step">
      <h2>{t("onboarding.chainTitle")}</h2>
      {!hasAccounts ? (
        <>
          <p className="hint">{t("onboarding.chainNoAccount")}</p>
          <div className="button-row">
            <button type="button" onClick={onSkip}>
              {t("common.skip")}
            </button>
            <button type="button" onClick={onFinish} disabled={finishing}>
              {t("onboarding.finishOnboarding")}
            </button>
          </div>
        </>
      ) : created ? (
        <>
          <p>{t("onboarding.chainCreated")}</p>
          <div className="button-row">
            <button type="button" onClick={onNext}>
              {t("common.next")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            {t("onboarding.chainAccount")}
            <select value={effectiveAccountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts?.map((a: Account) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("onboarding.chainName")}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t("onboarding.trigger")}
            <select value={trigger} onChange={(e) => setTrigger(e.target.value as TriggerType)}>
              <option value="unread_new">{t("common.triggerUnread")}</option>
              <option value="inbox_zero">{t("common.triggerInboxZero")}</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="button" onClick={onCreate} disabled={saving || !effectiveAccountId}>
              {saving ? t("onboarding.saving") : t("onboarding.createChain")}
            </button>
            <button type="button" onClick={onSkip}>
              {t("common.skip")}
            </button>
            <button type="button" onClick={onFinish} disabled={finishing}>
              {t("onboarding.finishOnboarding")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
