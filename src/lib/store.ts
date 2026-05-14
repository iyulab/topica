import { create } from "zustand";
import type { Topic, Content } from "./api";

export interface QueueItem {
  topicId: string;
  contentType: string;
}

interface AppStore {
  isConnected: boolean;
  setConnected: (v: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isConnected: false,
  setConnected: (v) => set({ isConnected: v }),
}));

interface TopicStore {
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  addTopic: (topic: Topic) => void;
  removeTopic: (id: string) => void;
}

export const useTopicStore = create<TopicStore>((set) => ({
  topics: [],
  setTopics: (topics) => set({ topics }),
  addTopic: (topic) => set((s) => ({ topics: [topic, ...s.topics] })),
  removeTopic: (id) => set((s) => ({ topics: s.topics.filter((t) => t.id !== id) })),
}));

interface ContentStore {
  // contentId → Content
  contents: Map<string, Content>;
  // topicId → contentId[]
  byTopic: Map<string, string[]>;
  setContents: (topicId: string, contents: Content[]) => void;
  addContent: (content: Content) => void;
}

export const useContentStore = create<ContentStore>((set) => ({
  contents: new Map(),
  byTopic: new Map(),
  setContents: (topicId, items) =>
    set((s) => {
      const next = new Map(s.contents);
      const ids: string[] = [];
      for (const c of items) {
        next.set(c.id, c);
        ids.push(c.id);
      }
      return { contents: next, byTopic: new Map(s.byTopic).set(topicId, ids) };
    }),
  addContent: (content) =>
    set((s) => {
      const next = new Map(s.contents);
      next.set(content.id, content);
      const topicIds = [...(s.byTopic.get(content.topicId) ?? [])];
      if (!topicIds.includes(content.id)) topicIds.push(content.id);
      return { contents: next, byTopic: new Map(s.byTopic).set(content.topicId, topicIds) };
    }),
}));

interface QueueStore {
  activeItems: QueueItem[];
  startItem: (item: QueueItem) => void;
  finishItem: (topicId: string, contentType: string) => void;
}

export const useQueueStore = create<QueueStore>((set) => ({
  activeItems: [],
  startItem: (item) =>
    set((s) => ({
      activeItems: [...s.activeItems, item],
    })),
  finishItem: (topicId, contentType) =>
    set((s) => ({
      activeItems: s.activeItems.filter(
        (i) => !(i.topicId === topicId && i.contentType === contentType)
      ),
    })),
}));
