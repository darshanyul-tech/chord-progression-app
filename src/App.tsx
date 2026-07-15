import { createHashRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { ExamRoute } from './exam/ExamRoute';
import { ErrorBoundary } from './shell/ErrorBoundary';
import { Layout } from './shell/Layout';
import { TopicHost } from './shell/TopicHost';
import { DEFAULT_TOPIC_ID, getTopic } from './topics/registry';

function TopicRoute() {
  const { id } = useParams<{ id: string }>();
  const topic = id ? getTopic(id) : undefined;
  // Unknown and parked (hidden) topics both fall back to the default topic.
  if (!topic || topic.hidden) {
    return <Navigate to={`/topic/${DEFAULT_TOPIC_ID}`} replace />;
  }
  return <TopicHost activeId={id!} />;
}

const router = createHashRouter([
  { path: '/', element: <Navigate to={`/topic/${DEFAULT_TOPIC_ID}`} replace /> },
  {
    path: '/topic/:id',
    element: (
      <Layout>
        <TopicRoute />
      </Layout>
    ),
  },
  {
    path: '/exam',
    element: (
      <Layout>
        <ExamRoute />
      </Layout>
    ),
  },
  { path: '*', element: <Navigate to={`/topic/${DEFAULT_TOPIC_ID}`} replace /> },
]);

function App() {
  return (
    <ErrorBoundary label="Ear Trainer">
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
