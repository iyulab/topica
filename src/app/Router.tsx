import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import TopicList from "../pages/TopicList";
import Studio from "../pages/Studio";
import Settings from "../pages/Settings";

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <TopicList /> },
      { path: "topics/:topicId/studio", element: <Studio /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
