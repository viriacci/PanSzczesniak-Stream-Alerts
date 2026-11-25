# PSSA Studio RC.14
- Existing scene JSON remains version 1; optional fields preserve old saved scenes and imported layouts.
- New unsaved alerts have transparent, bold white titles; reward names are gold. Preview and queued tests share a single fixture (25 viewers, 3 months).
- Media is fitted to intrinsic aspect ratio when chosen. Corner scaling preserves the fitted ratio by default; Shift allows free scaling. Crop handles clip the existing element, with numeric controls and reset.
- Timeline supports moving and trimming clips, media in-point offsets for audio/video, draggable keyframes, linear/smooth/hold interpolation for position, size, rotation, opacity. Trim removes keyframes outside the retained range; undo restores them. Keyframes are stored in scene and evaluated in the shared browser player, not just editor.
- Templates save the current draft to existing local library without changing saved alert; loading applies to draft and needs Save. Background is editor-only and not emitted to OBS; choice is session/editor scoped.
- Fluent-inspired React/CSS, not native WinUI 3. Real runtime UI and OBS browser behavior are covered by smoke tests; interactive acceptance on user's PC is still necessary.
