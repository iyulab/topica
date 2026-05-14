import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import TopicList from "../pages/TopicList";
import Studio from "../pages/Studio";
import Settings from "../pages/Settings";
import GraphPage from "../pages/Graph";

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <TopicList /> },
      { path: "topics/:topicId/studio", element: <Studio /> },
      { path: "graph", element: <GraphPage /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
