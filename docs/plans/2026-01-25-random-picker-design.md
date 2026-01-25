# Random Thing Picker - Design Document

A React Native app with Expo that lets users enter items and randomly pick one.

## Overview

Single-screen utility app for making random selections. Users add items to a list, tap a button to pick one at random, and see the result in a modal overlay.

## Core Behavior

- Items entered one at a time via text input
- Items stay in the list after being picked (can be picked again)
- No persistence between sessions (fresh start each app launch)
- Swipe left on any item to delete it

## Screen Layout

Four vertically stacked areas:

### 1. Header
Title: "Random Picker"

### 2. Input Area
- Text input with placeholder "Add an item..."
- "Add" button inline to the right
- Input clears after adding

### 3. Items List
- Scrollable list of entered items
- Swipe left reveals delete action
- Empty state: "Add some items to get started"

### 4. Pick Button
- Large button at bottom: "Pick Random"
- Disabled when fewer than 2 items
- Triggers random selection and opens modal

### Result Modal
- Semi-transparent dark overlay
- Centered white card with rounded corners
- Chosen item displayed prominently (large, bold text)
- "Done" button to dismiss

## State

```typescript
items: string[]           // list of entered items
inputText: string         // current input field value
selectedItem: string | null  // picked item (null = modal closed)
```

## Actions

| Action | Behavior |
|--------|----------|
| Add item | Append to `items`, clear `inputText` |
| Delete item | Remove from `items` by index |
| Pick random | Set `selectedItem` to random item from list |
| Close modal | Set `selectedItem` to `null` |

## Validation

- Reject empty or whitespace-only input
- Require at least 2 items to enable picking

## Technical Stack

- Expo (blank TypeScript template)
- `react-native-gesture-handler` for swipe-to-delete
- React Native's built-in `Modal` component
- No external state management (useState sufficient)
- No navigation library (single screen)

## File Structure

```
app/
  index.tsx          — Main screen
components/
  AddItemInput.tsx   — Text input with add button
  ItemList.tsx       — List with swipe-to-delete
  PickButton.tsx     — Random pick button
  ResultModal.tsx    — Modal showing picked item
```

## Visual Design

- Clean, minimal with whitespace
- Light background (white/off-white)
- Single accent color for interactive elements
- Rounded corners on inputs, buttons, modal card
- Red swipe-delete action

## Edge Cases

| Case | Handling |
|------|----------|
| Empty list | Show message, disable pick button |
| Single item | Disable pick button |
| Duplicate items | Allow (weighted odds) |
| Long text | Truncate in list, wrap in modal |
| Keyboard open | Dismiss on outside tap, Return key adds item |
