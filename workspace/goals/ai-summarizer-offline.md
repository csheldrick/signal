# AI Summarizer Offline

## Goal

Create an offline version of the AI summarizer that can be used without an internet connection.

## Requirements

- The summarizer must function without any network connectivity
- The summarizer should be able to process and summarize text stored locally on the device
- The summarizer should be able to save and retrieve summaries from local storage
- The summarizer should replicate a local LLM without relying on external APIs.
- The summarizer should be able to run on a variety of devices, including those with limited resources

## Loom/Weave implications

- The summarizer should be entirely self-contained, with no dependencies on external services or APIs
- Loom can analyze the summarizer's code to ensure it does not contain any network calls or dependencies on online services
- Weave can track the summarizer's execution to ensure it operates correctly in an offline environment and does not attempt to access the network
- The summarizer's local storage interactions can be monitored by Weave to ensure data is being saved and retrieved correctly without any network involvement