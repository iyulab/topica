import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import TopicList from "../pages/TopicList";
import Studio from "../pages/Studio";

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <TopicList /> },
      { path: "topics/:topicId/studio", element: <Studio /> },
    ],
  },
]);
