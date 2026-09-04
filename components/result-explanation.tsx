import type { FundExplanation } from '@/lib/funds/explanations';

export function ResultExplanation({ id, explanation }: { id: string; explanation: FundExplanation | null }) {
  if (!explanation) return null;
  return <aside className="result-explanation" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Vad betyder det här?</h3>
    <p className="result-explanation-context">{explanation.context}</p>
    <ul>{explanation.items.map(item => <li key={item.title}><h4>{item.title}</h4><p>{item.text}</p></li>)}</ul>
    <p className="result-explanation-limit">{explanation.limitation}</p>
  </aside>;
}
