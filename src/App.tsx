import { createHashRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { Layout } from './shell/Layout';
import { TopicHost } from './shell/TopicHost';
import { DEFAULT_TOPIC_ID, getTopic } from './topics/registry';

function TopicRoute() {
  const { id } = useParams<{ id: string }>();
  if (!id || !getTopic(id)) {
    return <Navigate to={`/topic/${DEFAULT_TOPIC_ID}`} replace />;
  }
  return <TopicHost activeId={id} />;
}

function ExamRoute() {
  return (
    <section className="card">
      <h2>Exam mode</h2>
      <p className="sub">Exam mode is coming in a later implementation phase.</p>
    </section>
  );
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
  return <RouterProvider router={router} />;
}

export default App;
