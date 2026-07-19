import { useState } from "react";
import { useTranslation } from "react-i18next";
import { actionChainsApi, type HttpStepConfig, type StepType } from "../../api/actionChains";

interface Props {
  stepType: StepType;
  config: HttpStepConfig;
  accountId?: string;
}

export function TestSendPanel({ stepType, config, accountId }: Props) {
  const { t } = useTranslation();
  const [result, setResult] = useState<Awaited<ReturnType<typeof actionChainsApi.testSend>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);

  const onTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await actionChainsApi.testSend({ step_type: stepType, config, account_id: accountId });
      setResult(res);
    } catch {
      setResult({ success: false, status_code: null, response_headers: null, body_preview: null, error: t("testSendPanel.testFailed") });
    } finally {
      setLoading(false);
    }
  };

  const statusClass = result?.error
    ? "status-error"
    : result && result.status_code && result.status_code < 300
      ? "status-ok"
      : result
        ? "status-warn"
        : "";

  return (
    <div className="test-send-panel">
      <button type="button" onClick={onTest} disabled={loading}>
        {loading ? t("testSendPanel.sending") : t("testSendPanel.testSend")}
      </button>
      {result && (
        <div className={`test-send-result ${statusClass}`}>
          {result.error ? (
            <p>✗ {result.error}</p>
          ) : (
            <>
              <p>
                {t("testSendPanel.statusLabel")} <strong>{result.status_code}</strong>
              </p>
              {result.response_headers && (
                <div>
                  <button type="button" onClick={() => setHeadersOpen(!headersOpen)}>
                    {headersOpen ? t("testSendPanel.hideHeaders") : t("testSendPanel.showHeaders")}
                  </button>
                  {headersOpen && (
                    <pre className="response-preview">{JSON.stringify(result.response_headers, null, 2)}</pre>
                  )}
                </div>
              )}
              {result.body_preview && (
                <details>
                  <summary>{t("testSendPanel.responseBody")}</summary>
                  <pre className="response-preview">{result.body_preview}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
