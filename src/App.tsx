import { useState } from 'react';
import { createHashRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { ExamRoute } from './exam/ExamRoute';
import { ErrorBoundary } from './shell/ErrorBoundary';
import { HomePage } from './shell/HomePage';
import { Layout } from './shell/Layout';
import { TopicHost } from './shell/TopicHost';
import { DEFAULT_TOPIC_BY_SECTION, getTopic, topicPath, type SectionId } from './topics/registry';

function TopicRoute({ section }: { section: SectionId }) {
  const { id } = useParams<{ id: string }>();
  const topic = id ? getTopic(id) : undefined;
  // Unknown and parked (hidden) topics both fall back to this section's default topic.
  if (!topic || topic.hidden) {
    return <Navigate to={`/${section}/topic/${DEFAULT_TOPIC_BY_SECTION[section]}`} replace />;
  }
  // A topic id requested under the wrong section prefix redirects to its
  // actual section's URL — never a 404 (13-home-and-sections.md §2).
  const topicSection = topic.section ?? 'aural';
  if (topicSection !== section) {
    return <Navigate to={topicPath(id!)} replace />;
  }
  return <TopicHost activeId={id!} />;
}

// Preserves pre-sections bookmarks/links: old /topic/:id URLs redirect to
// their topic's real section-prefixed route (13-home-and-sections.md §2).
function LegacyTopicRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? topicPath(id) : '/'} replace />;
}

function buildRouter() {
  return createHashRouter([
    { path: '/', element: <HomePage /> },
    {
      path: '/aural/topic/:id',
      element: (
        <Layout>
          <TopicRoute section="aural" />
        </Layout>
      ),
    },
    {
      path: '/theory/topic/:id',
      element: (
        <Layout>
          <TopicRoute section="theory" />
        </Layout>
      ),
    },
    { path: '/topic/:id', element: <LegacyTopicRedirect /> },
    {
      path: '/exam',
      element: (
        <Layout>
          <ExamRoute />
        </Layout>
      ),
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ]);
}

function App() {
  // Lazily built once per mount (reads window.location.hash at that point) —
  // a module-level singleton would leak route state across separate <App/>
  // mounts in tests; production only ever mounts one <App/>, so this is
  // behaviorally identical there.
  const [router] = useState(buildRouter);
  return (
    <ErrorBoundary label="TryTone">
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
