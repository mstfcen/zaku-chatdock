# Zaku ChatDock Privacy

Zaku ChatDock does not operate an analytics, advertising, telemetry,
or user-data collection service.

## Terminal data

Terminal input and output is handled locally by the ChatDock browser
extension and the installed ChatDock Companion.

Remote terminal sessions, when configured, use the user's own SSH
configuration and destination.

## Run + Send

`Run + Send` is an explicit user action.

When the user chooses it, ChatDock inserts the selected terminal result
into the current ChatGPT conversation. That content is then handled by
ChatGPT under the user's ChatGPT account and the applicable OpenAI
terms and privacy controls.

ChatDock does not send that terminal result to a separate ChatDock
server or developer-operated backend.

## Local configuration

ChatDock configuration is stored locally on the user's computer.

The Native Messaging Companion is also installed locally.

## Update checks

The Companion may request public version/update metadata and files from
this project's GitHub repository.

Release metadata includes a SHA-256 digest that is used to verify the
downloaded native-host file against the published metadata.

This integrity check should not be interpreted as protection against a
compromise of the repository or its release metadata.

## Browser stores

Firefox or other browser stores may process ordinary installation and
update information according to their own policies.

## Contact

Project repository and issue tracker:

    https://github.com/mstfcen/zaku-chatdock
