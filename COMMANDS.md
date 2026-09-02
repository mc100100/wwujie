# Project Command History

Based on your project metadata and codebase, here is the organized list of "effective commands" (features and modules) implemented since project creation:

## 1. Core Infrastructure Setup
- Initialize React 19 + Vite 6 project with TypeScript.
- Configure Tailwind CSS with Dark Mode support.
- Set up Capacitor for mobile native filesystem access.
- Configure path alias `@` mapping to project root.

## 2. Infinite Canvas (Visual Core)
- **Implement Infinite Canvas**: Support for pan, zoom, grid background, and infinite scrolling space.
- **Node System**: Support for draggable/resizable Image, Video, and Text nodes.
- **LOD Optimization**: Level-of-Detail rendering to maintain 60fps performance with many elements.
- **Gesture Control**: Touch gesture support for zooming and panning.

## 3. UI/UX Components
- **Floating Menu (FAB)**: Expandable quick action menu (Upload, Add Text, Clear, etc.).
- **Sidebar Panel**: Collapsible sidebar for Image/Video generation tasks and history.
- **Settings Modal**: API configuration (Host, Key) and Theme toggling.
- **Context Menu**: Right-click actions (Delete, Lock, Split Storyboard, Save to Library).
- **Lightbox**: Full-screen media previewer.
- **MD3 Design**: Material Design 3 styled inputs and selects.

## 4. AI Agents & Generation
- **Gemini Box**: Integrated Chat Window for general AI assistance.
- **Character Agent**: Specialized agent for generating character design prompts (Role, Style, Weight, etc.).
- **Storyboard Agent**: Agent for converting novel text into video storyboard scripts.
- **Generation Task Manager**: Handle async image/video generation tasks with polling.
- **Fusion Modes**: "Reference Image" and "Reference Video" workflows.

## 5. Data & Project Management
- **IndexedDB Storage**: Local persistence for projects and assets using `utils/db.ts`.
- **Project Manager**: Create, switch, delete, export, and import multiple projects.
- **Asset Library**: Centralized management for generated images/videos.
- **Auto-Save**: Automatic project state saving.
- **Cloud Sync**: Optional R2 storage synchronization.

## 6. Advanced Tools
- **Batch Mode**: Multi-select elements for bulk deletion or stitching.
- **Stitch Export**: Generate a "puzzle" image from selected canvas elements.
- **Sora Character Creator**: Specific UI for creating consistent characters via video upload.
