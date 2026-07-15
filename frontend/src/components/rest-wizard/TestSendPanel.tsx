import { useState } from "react";
import { actionChainsApi, type HttpStepConfig, type StepType } from "../../api/actionChains";

interface Props {
  stepType: StepType;
  config: HttpStepConfig;
  accountId?: string;
}

export function TestSendPanel({ stepType, config, accountId }: Props) {
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
      setResult({ success: false, status_code: null, response_headers: null, body_preview: null, error: "Test fehlgeschlagen" });
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
        {loading ? "Sende..." : "Test senden"}
      </button>
      {result && (
        <div className={`test-send-result ${statusClass}`}>
          {result.error ? (
            <p>✗ {result.error}</p>
          ) : (
            <>
              <p>
                Status: <strong>{result.status_code}</strong>
              </p>
              {result.response_headers && (
                <div>
                  <button type="button" onClick={() => setHeadersOpen(!headersOpen)}>
                    {headersOpen ? "Header ausblenden" : "Header anzeigen"}
                  </button>
                  {headersOpen && (
                    <pre className="response-preview">{JSON.stringify(result.response_headers, null, 2)}</pre>
                  )}
                </div>
              )}
              {result.body_preview && (
                <details>
                  <summary>Response-Body</summary>
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
