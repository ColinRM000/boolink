# `@boolink/sdk`

The BooLink adapter for exposing validated integration definitions through the official Model
Context Protocol SDK.

Provider API clients stay transport-independent. This package owns the MCP boundary, including
stdio server adaptation and safe error conversion. Diagnostic output must use `stderr`; `stdout`
is reserved for MCP frames.
