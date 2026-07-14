import { Link } from 'react-router-dom';
import type { TopicDefinition } from '../topics/registry';
import { useUIStore } from '../state/ui';

export function PlaceholderView({ topic }: { topic: TopicDefinition }) {
  const lastActiveTopicId = useUIStore((s) => s.lastActiveTopicId);

  return (
    <section className="card">
      <h2>{topic.title}</h2>
      <p className="sub">
        {topic.placeholderCopy ?? "This topic is part of the syllabus but isn't built yet."}
      </p>
      <p>
        <Link to={`/topic/${lastActiveTopicId}`}>Back</Link>
      </p>
    </section>
  );
}
