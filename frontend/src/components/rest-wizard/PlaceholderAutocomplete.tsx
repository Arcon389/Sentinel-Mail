import { useQuery } from "@tanstack/react-query";
import { actionChainsApi } from "../../api/actionChains";

interface Props {
  onInsert: (placeholder: string) => void;
}

export function PlaceholderAutocomplete({ onInsert }: Props) {
  const { data: placeholders } = useQuery({
    queryKey: ["placeholders"],
    queryFn: actionChainsApi.placeholders,
    staleTime: Infinity,
  });

  if (!placeholders?.length) return null;

  return (
    <div className="placeholder-list">
      <span className="placeholder-list-label">Platzhalter:</span>
      {placeholders.map((p) => (
        <button
          key={p.key}
          type="button"
          className="placeholder-chip"
          title={p.description}
          onClick={() => onInsert(`{${p.key}}`)}
        >
          {`{${p.key}}`}
        </button>
      ))}
    </div>
  );
}
