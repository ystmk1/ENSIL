import { InteractiveCreature } from '../components/experience/InteractiveCreature';
import { CREATURE_RECORDS, getCreatureRecord } from '../data/creatureRecords';

export function CreatureRecordPage({ id }: { id: string }) {
  const record = getCreatureRecord(id);
  const index = CREATURE_RECORDS.findIndex((creature) => creature.id === record.id);
  const previous = CREATURE_RECORDS[(index - 1 + CREATURE_RECORDS.length) % CREATURE_RECORDS.length];
  const next = CREATURE_RECORDS[(index + 1) % CREATURE_RECORDS.length];

  return (
    <main className="record-page">
      <section className="record-hero">
        <div className="record-meta-rail">
          <span>{record.code}</span>
          <span>{record.status}</span>
          <span>STATE / OBSERVING</span>
        </div>
        <div className="record-title">
          <span>SPECIMEN {String(index + 1).padStart(2, '0')}</span>
          <h1>{record.name}</h1>
        </div>
        <InteractiveCreature record={record} />
        <a className="record-return" href="#/field">RETURN TO FIELD ↗</a>
      </section>

      <section className="response-diagram">
        <p>BEHAVIOUR CIRCUIT / {record.code}</p>
        <div className="response-diagram__flow">
          <div><span>INPUT</span><strong>{record.input}</strong></div>
          <i>→</i>
          <div><span>SENSOR</span><strong>{record.sensor}</strong></div>
          <i>→</i>
          <div><span>RESPONSE</span><strong>{record.response}</strong></div>
        </div>
      </section>

      <section className="record-ecology">
        <header>
          <p>SPECIMEN PROFILE / 04 FIELDS</p>
          <h2>A BODY IS A WAY<br />OF PAYING ATTENTION.</h2>
        </header>
        <dl>
          {Object.entries(record.archive).map(([key, value], ecologyIndex) => (
            <div key={key}>
              <dt>0{ecologyIndex + 1} / {key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="record-observations">
        <header>
          <p>RECENT STATE TRANSITIONS</p>
          <span>LOCAL SESSION / CONTINUOUS</span>
        </header>
        <ol>
          {record.observations.map((observation) => (
            <li key={observation.time}>
              <time>{observation.time}</time>
              <strong>{observation.state}</strong>
              <p>{observation.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <nav className="record-pagination" aria-label="Creature records">
        <a href={`#/creature/${previous.id}`}><span>← PREVIOUS</span><strong>{previous.name}</strong></a>
        <a href="#/"><span>ARCHIVE</span><strong>ALL FOUR RECORDS</strong></a>
        <a href={`#/creature/${next.id}`}><span>NEXT →</span><strong>{next.name}</strong></a>
      </nav>
    </main>
  );
}
