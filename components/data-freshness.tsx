import { formatDataDate, formatFetchTime } from '@/lib/funds/freshness';

type Props = {
  observationLabel: string;
  observationDate?: string | null;
  unknownObservation?: string;
  fetchedAt?: string | null;
  fetchLabel?: string;
  publishedAt?: string | null;
  note: string;
};

export function DataFreshness({ observationLabel, observationDate, unknownObservation = 'Datum saknas i underlaget', fetchedAt, fetchLabel = 'Hämtat från källan', publishedAt, note }: Props) {
  return <div className="data-freshness" aria-label="Informationens datum">
    <dl>
      <div><dt>{observationLabel}</dt><dd>{observationDate ? <time dateTime={observationDate}>{formatDataDate(observationDate)}</time> : unknownObservation}</dd></div>
      {publishedAt && <div><dt>Publicerat av källan</dt><dd><time dateTime={publishedAt}>{formatDataDate(publishedAt)}</time></dd></div>}
      <div><dt>{fetchLabel}</dt><dd>{fetchedAt ? <time dateTime={fetchedAt}>{formatFetchTime(fetchedAt)}</time> : 'Hämtningstid saknas i underlaget'}</dd></div>
    </dl>
    <p>{note}</p>
  </div>;
}
