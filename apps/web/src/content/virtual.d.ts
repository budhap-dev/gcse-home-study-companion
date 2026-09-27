declare module 'virtual:topic-catalogue' {
  const data: import('./index.ts').TopicSummary[]
  export default data
}
declare module 'virtual:search-text' {
  const data: import('../search/index.ts').SearchTopic[]
  export default data
}
