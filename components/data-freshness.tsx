'use client';

import { useEffect, useState } from 'react';
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

export function DataFreshness({
  observationLabel,
  observationDate,
  unknownObservation = 'Datum saknas i underlaget',
  fetchedAt,
  fetchLabel = 'Hämtat från källan',
  publishedAt,
  note,
}: Props) {
  const [age, setAge] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      if (!observationDate || !/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) {
        setAge(null);
        return;
      }
      const timestamp = Date.parse(`${observationDate}T12:00:00Z`);
      const days = Math.floor((Date.now() - timestamp) / 86400000);
      setAge(
        days < 0
          ? null
          : days === 0
            ? 'avser i dag'
            : days === 1
              ? '1 dag gammalt'
              : `${days} dagar gammalt`,
      );
    });
  }, [observationDate]);

  return (
    <div className="data-freshness" aria-label="Informationens datum">
      <dl>
        <div>
          <dt>{observationLabel}</dt>
          <dd>
            {observationDate ? (
              <>
                <time dateTime={observationDate}>
                  {formatDataDate(observationDate)}
                </time>
                {age && <span className="freshness-age">{age}</span>}
              </>
            ) : (
              unknownObservation
            )}
          </dd>
        </div>
        {publishedAt && (
          <div>
            <dt>Publicerat av källan</dt>
            <dd>
              <time dateTime={publishedAt}>{formatDataDate(publishedAt)}</time>
            </dd>
          </div>
        )}
        <div>
          <dt>{fetchLabel}</dt>
          <dd>
            {fetchedAt ? (
              <time dateTime={fetchedAt}>{formatFetchTime(fetchedAt)}</time>
            ) : (
              'Hämtningstid saknas i underlaget'
            )}
          </dd>
        </div>
      </dl>
      <p>{note}</p>
    </div>
  );
}
