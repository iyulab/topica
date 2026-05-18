import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Topic, Content } from "./api";

export interface QueueItem {
  topicId: string;
  contentType: string;
}

export interface FailedItem {
  topicId: string;
  contentType: string;
  errorMessage: string;
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
  failedItems: FailedItem[];
  startItem: (item: QueueItem) => void;
  finishItem: (topicId: string, contentType: string) => void;
  failItem: (topicId: string, contentType: string, errorMessage: string) => void;
}

export interface LearningQueueItem {
  topicId: string;
  title: string;
  addedAt: string;
}

interface LearningQueueStore {
  items: LearningQueueItem[];
  addItem: (item: LearningQueueItem) => void;
  removeItem: (topicId: string) => void;
  clearAll: () => void;
}

export const useLearningQueueStore = create<LearningQueueStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((s) => ({
          items: s.items.some((i) => i.topicId === item.topicId)
            ? s.items
            : [...s.items, item],
        })),
      removeItem: (topicId) =>
        set((s) => ({ items: s.items.filter((i) => i.topicId !== topicId) })),
      clearAll: () => set({ items: [] }),
    }),
    { name: "topica-learning-queue" }
  )
);

export const useQueueStore = create<QueueStore>((set) => ({
  activeItems: [],
  failedItems: [],
  startItem: (item) =>
    set((s) => ({
      activeItems: [...s.activeItems, item],
      failedItems: s.failedItems.filter(
        (f) => !(f.topicId === item.topicId && f.contentType === item.contentType)
      ),
    })),
  finishItem: (topicId, contentType) =>
    set((s) => ({
      activeItems: s.activeItems.filter(
        (i) => !(i.topicId === topicId && i.contentType === contentType)
      ),
    })),
  failItem: (topicId, contentType, errorMessage) =>
    set((s) => ({
      activeItems: s.activeItems.filter(
        (i) => !(i.topicId === topicId && i.contentType === contentType)
      ),
      failedItems: [
        ...s.failedItems.filter(
          (f) => !(f.topicId === topicId && f.contentType === contentType)
        ),
        { topicId, contentType, errorMessage },
      ],
    })),
}));
