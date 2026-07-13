# Group Chat Simulator

A Discord-like chat app where every group member except you is an AI-controlled character, powered by the Anthropic API. The original product specification is preserved below; the implementation lives in `server/` (Express + SQLite + Anthropic SDK) and `client/` (React + Vite + Tailwind).

## Getting Started

Requirements: Node.js 20+ and an Anthropic API key (BYOK — usage bills to your own Anthropic account).

```sh
npm install
npm run dev        # server on :3001, client on :5173
```

Open http://localhost:5173, click the ⚙️ gear, and paste your Anthropic API key (or set `ANTHROPIC_API_KEY` in the environment before starting). Then hit **+** to create your first group.

- `npm test` — unit tests for the memory-decay model
- `npm run build && npm start` — production build served by the Express server on :3001
- All data (SQLite DB, uploaded images/files) lives in `server/data/`, which is gitignored

### Implementation notes / deviations from the spec

- §8.4: "purchase tokens through the app" was dropped — the app is BYOK only. The soft-limit warnings (large group / long conversation) are implemented as specified.
- Who speaks is decided by a small "director" model call (characters you address by name always reply). The §8.3 toggle enables capped AI-to-AI follow-ups (max 3 per user message).
- Memory decay (§8.2): recall probability halves every 30 days, observer memories decay 2× faster, and records below 2% recall probability are permanently pruned. Constants live in `server/src/engine/decay.ts`.

---

# Product Specification

## 1. Core Concept

A Discord like chat application where, instead of joining servers with real people, the user creates and joins group chats populated entirely by AI controlled characters. Each character has an editable personality and background, and behaves as an independent conversational agent that can text, receive images and files, and respond naturally within the group context.

## 2. Interface

The app should mirror Discord's layout and interaction patterns as closely as possible, since the user already understands that UX:

* A sidebar listing joined groups (servers)
* A main channel/chat view showing the message history
* A member list showing the AI characters currently in the group
* A message composer supporting text, image upload, and file upload
* Basic message features: timestamps, avatars, typing indicators (simulated), read state

## 3. Group Creation Flow

1. User clicks "Join" or "Create Group"
2. User specifies how many AI members should be in the group
3. For each member, the user fills out a profile:
   * Name
   * Personality traits (freeform text or structured tags)
   * Background/backstory
   * Optional avatar image
   * Optional relationship to the user or to other members
4. Once setup is complete, the user "enters" the group and can begin chatting

## 4. AI Character Behavior

Each AI member should:

* Respond according to its defined personality and background
* Be aware of the other members present in the group and react to them (not just the user), enabling multi party AI to AI dynamics
* Accept and respond to images and files sent by the user, referencing their content in a way consistent with the character's personality
* Maintain conversational memory scoped to the group it is currently in, at minimum

## 5. Cross Group Characters ("Friends")

This is the more advanced system layered on top of the base group chat:

* A character created in one group can be added as a "friend"
* Once added as a friend, that character can be invited into other groups the user creates
* When a friended character moves between groups, it retains its own memory of prior interactions with the user, and with other characters it has previously interacted with, across all groups it has joined (subject to the memory decay model in Section 8.2)

## 6. Direct Friend Creation

* Users can create a character directly as a "friend" without first placing them in a group
* This friend can then be added into any existing or new group
* Whether a character has been given the user's "personal contact information" (i.e., friended directly, or added as a contact) should be tracked as a state flag
* This flag can influence behavior, for example: a character without contact info may, in certain contexts, ask the user in chat if they can be added as a friend

## 7. Data Model (Suggested)

To make this buildable, the following entities are implied by the description:

* **User**: the human operator
* **Character**: id, name, personality description, background, avatar, "is_friend" flag, "has_contact_info" flag
* **Group**: id, name, list of member character ids
* **Message**: id, group id, sender id (user or character), content, attachments (image/file), timestamp
* **Memory**: scoped per character (not per group), so a friended character carries memory with them across every group they join. Each memory record should store at minimum: the content or summary of what happened, which characters were involved, which group it occurred in, a timestamp or turn index, and a flag for whether this character actively participated or only passively observed. These fields feed the decay model described in Section 8.2, which determines whether a given memory is still recalled when generating that character's responses

## 8. Decisions on Open Questions

These decisions were made after reviewing the initial open questions. They should be treated as settled design choices for the build.

### 8.1 Cross group memory of other characters

Confirmed: a friended character retains memory not only of the user, but also of other characters they've previously interacted with, even across different groups. This means the Memory entity described in Section 7 cannot be scoped strictly to a single group. It needs to be scoped per character, and each memory record should note which characters and which group were involved, so that a character can recall "I met X while talking with the user in Group A" even after moving to Group B.

### 8.2 Probabilistic memory decay

Memory is not stored as full permanent history. Instead, each memory record should decay over time according to a forgetting model with these properties:

* The probability that a given memory is forgotten increases the older that memory is. This suggests something like a decay function where recency reduces forgetting probability (for example, an exponential or logarithmic decay curve applied per memory record based on its age or turn distance from the present).
* If a character was a passive observer of a piece of conversation (present in the group, but did not speak or otherwise participate in that exchange), the forgetting probability for that memory should be increased further, on top of the age based decay. Observed but unparticipated memories should decay faster than memories the character actively took part in.
* Practically, this means each memory record needs at least: a timestamp or turn index, a flag for whether the character actively participated versus passively observed, and some decay calculation that runs periodically (or at read time) to determine whether that memory is still recalled, partially recalled, or fully forgotten.
* This is a nontrivial system. It is reasonable to start with a simplified version for the MVP (for example, a straightforward decay probability based on age, plus a fixed multiplier for unparticipated memories) and refine the curve later based on how it feels in practice.

### 8.3 Character to character conversation toggle

Add a toggle button within the group chat interface, for example labeled "Allow characters to talk to each other." When switched on, characters are permitted to initiate conversation with each other unprompted, not only respond when addressed by the user. When off, characters only respond when addressed directly or when the user sends a message. This should be a per group setting, visible and controllable from within that group's interface.

### 8.4 Group size and cost limits

Rather than a hard limit, apply a soft limit. Since each AI character response likely requires a separate model call, cost and context length grow with group size and conversation length. The user is expected to either purchase tokens through the app or bring their own API key (BYOK). Regardless of which, the interface should surface a warning when a group is getting large or a conversation is getting long, explaining the token usage implications and the potential for degraded performance or slower responses in long running conversations. The user should then be allowed to proceed anyway if they choose. No hard cap is enforced by default.

### 8.5 Contradictory backstories between characters

Since character backgrounds are authored directly by the user, the user is responsible for resolving any contradictions themselves. The system does not need to detect or reconcile conflicting backstories automatically. If a better automated solution becomes worth building later, it can be revisited, but it is not required for the initial build.

### 8.6 Editing a character's personality after creation

Editing is allowed, but it should not affect the character's existing memory. Before an edit takes effect, the interface should show a warning asking the user to confirm they actually want to change the character's personality or background. Once confirmed, the personality or background is updated, but any past memory records the character holds remain untouched and continue to decay according to the model described in Section 8.2.

## 9. Suggested Build Order (MVP first)

1. Basic single group chat with multiple AI characters responding to user text messages
2. Character creation form (name, personality, background)
3. Image and file attachment support in messages
4. Multiple groups, with ability to create/switch between them
5. Friend system: mark a character as a friend, add existing friends to new groups
6. Cross group memory persistence for friended characters
7. Discord style UI polish (sidebar, member list, avatars, etc.)
