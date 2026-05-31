// Re-export LocalSummarizer from the app implementation to provide a
// single canonical class across both app/src and src/ imports.
// Import the TS module so TypeScript can see the declared types and
// ensure the static method shape (tryRecordRequest/_tryRecordRequest)
// is preserved at compile time.

import { LocalSummarizer, RemoteSummarizer, LOCAL_SUMMARIZER_USES_ON_DISK_MODEL, REMOTE_SUMMARIZER_USES_ON_DISK_MODEL } from "../../app/src/ai/summarizer";
export { LocalSummarizer, RemoteSummarizer, LOCAL_SUMMARIZER_USES_ON_DISK_MODEL, REMOTE_SUMMARIZER_USES_ON_DISK_MODEL };
