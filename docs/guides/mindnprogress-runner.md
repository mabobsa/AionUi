# MindNProgress Runner sidecar

The personal AionUi fork can run a MindNProgress sub-machine Runner as a desktop sidecar. The sidecar starts and stops with AionUi, so users do not need a separate terminal command or login daemon.

## Requirements

- A packaged AionUi desktop build that includes the Runner sidecar
- For ordinary conversation forwarding, an existing AionCore installation supported by that AionUi build; no separate AionCore rebuild is required (managed remote pools have additional requirements below)
- Network access from the sub-machine to the main MindNProgress public URL
- A sub-machine registered by the same MindNProgress editor account that will use it

## Connect a sub-machine

1. Start AionUi on the intended sub-machine.
2. On that same machine, open the main MindNProgress URL in a browser and sign in.
3. Open **Distributed Work settings**, register the sub-machine, and select **Connect AionUi**.
4. Allow macOS or Windows to open the `aionui://` link.
5. In AionUi, verify the MindNProgress server and machine ID, then approve the connection.
6. Check the result under **Settings → Integrations → MindNProgress Runner**.
7. Return to MindNProgress, enable distributed work, select the default execution machine if needed, save, and run the connection probe.

To restore the Runner automatically after a reboot, enable **Settings → System → Start on boot**. AionUi starts after OS login and restores the configured Runner after its local AionCore is ready.

## Lifecycle and security

- Pairing links contain a target machine ID and a 10-minute, single-use code, never the durable Runner token.
- AionUi asks the user to confirm the server and machine ID. Redirected exchanges and mismatched responses are rejected.
- Credentials are encrypted with Electron `safeStorage`. Pairing is unavailable when the operating-system credential store is not secure.
- The token is not placed in renderer state, application routes, logs, or process arguments.
- The sidecar independently allows only the AionCore API routes and methods required by MindNProgress.
- History-only completion reports allow only `POST /api/conversations/{id}/external-reports` without query parameters. Forwarding this endpoint does not itself request AI execution.
- Each claimed operation is validated independently. A disallowed request with valid operation credentials returns `RUNNER_OPERATION_REJECTED` immediately, without calling AionCore or abandoning valid operations in the same batch. Malformed credentials are never used to address a result endpoint.
- Local call exceptions and AionCore failure messages are returned as failure results. If a result response is lost, only that same result is retried; the local request is not executed again.
- For sub-machine WebUI launches, the sidecar opens an ephemeral `127.0.0.1`-only callback relay. It accepts only the tokenized AionUi conversation-completion route and forwards it through the authenticated outbound MindNProgress connection; no LAN listener or firewall rule is added.
- Unexpected non-authentication exits restart automatically. Authentication rejection remains visible as an error instead of causing a restart loop.
- During AionUi shutdown, the sidecar stops claiming work and gets a short window to finish reporting claimed results before AionCore stops.
- An unconfigured AionUi does not launch the Runner process. Browser-only WebUI sessions do not expose the Runner settings page.

**Disconnect** removes the credential from this AionUi and stops its sidecar. To invalidate the server-side Runner permission as well, use **Revoke server permission** in MindNProgress Distributed Work settings. Pairing again also rotates the server token.

Runner-only fixes require the updated AionUi sidecar to be loaded on each affected machine, but do not require an AionCore rebuild. Existing completion reports can be retried with their original operation IDs without rerunning the child AI work.

## Managed remote Unity Fork pools

Ordinary conversation forwarding does not register a managed workspace pool. Remote Fork delegation is opt-in and additionally requires AionCore `workspaceLeaseVersion >= 3` with `remoteWorkspaceOwnership=true`, an updated MnP server/local pool owner, and explicit pool approval in MnP.

Start AionUi with both absolute environment paths:

- `MNP_RUNNER_WORKSPACE_REGISTRY`: the verified sub-machine registry, with the main server's `coordinatorId`, `poolId`, `sharedRoot`, matching `originUrl`, and enabled worker Git roots.
- `MNP_RUNNER_WORKSPACE_AGENT_MODULE`: the installed MnP `runner/lib/workspaceAgent.mjs`. This shared engine and its relative MnP modules must be installed together, not copied as a single file.

The sidecar loads this engine only when explicitly configured. `/mnp/workspaces` is handled inside the Runner, never forwarded to the local unauthenticated AionCore API. Remote-owned dispatches require a matching durable local reservation before AionCore receives them. Other conversations keep their existing behavior.

The Runner reports actual Git/runtime state in its authenticated heartbeat. Main-side approval is separate from reporting. Transfers use chunked, hash-verified Git bundles; integration occurs in main-side staging and completion waits for the Runner's release acknowledgement. Disconnects, interrupted receipts, ownership mismatches, and integration conflicts preserve the lease instead of freeing it. Stale locks require operator inspection, not timeout-based deletion. Do not register the same physical Fork in active local and remote pools.

See the MnP repository's `docs/remote-fork-workspaces.md` for the protocol, limits, activation checks, and explicit recovery APIs. This capability is not automatically enabled by pairing or by setting `workspacePoolIds`.
