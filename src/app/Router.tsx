import React, { lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import TopicList from "../pages/TopicList";

const Studio = lazy(() => import("../pages/Studio"));
const Settings = lazy(() => import("../pages/Settings"));
const GraphPage = lazy(() => import("../pages/Graph"));
const LearningStats = lazy(() => import("../pages/LearningStats"));

const Loading = () => (
  <div style={{ padding: 32, textAlign: "center", color: "#aaa" }}>로딩 중…</div>
);

function wrap(el: React.ReactElement) {
  return <Suspense fallback={<Loading />}>{el}</Suspense>;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <TopicList /> },
      { path: "topics/:topicId/studio", element: wrap(<Studio />) },
      { path: "graph", element: wrap(<GraphPage />) },
      { path: "settings", element: wrap(<Settings />) },
      { path: "stats", element: wrap(<LearningStats />) },
    ],
  },
]);
