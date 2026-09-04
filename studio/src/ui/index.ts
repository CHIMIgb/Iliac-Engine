/**
 * ui/index.ts — Barrel export de todos los componentes UI
 */

// Icon
export { createIcon, iconHTML, listIcons } from './Icon.js';

// Button
export { createButton, buttonHTML, type ButtonOptions, type ButtonVariant, type ButtonSize } from './Button.js';

// Input
export { createInput, inputHTML, type InputOptions, type InputType } from './Input.js';

// Tabs
export { createTabs, tabsHTML, type TabsOptions, type TabItem } from './Tabs.js';

// Table
export { createTable, tableHTML, type TableOptions, type TableColumn } from './Table.js';

// Modal
export { createModal, closeTopModal, closeAllModals, type ModalOptions, type ModalInstance } from './Modal.js';

// Toast
export { showToast, closeAllToasts, toast, type ToastOptions, type ToastVariant } from './Toast.js';

// Spinner
export { createSpinner, spinnerHTML, type SpinnerOptions, type SpinnerSize } from './Spinner.js';

// Skeleton
export { createSkeleton, skeletonHTML, type SkeletonOptions } from './Skeleton.js';

// ProgressBar
export { createProgressBar, progressBarHTML, type ProgressBarOptions } from './ProgressBar.js';

// EmptyState
export { createEmptyState, emptyStateHTML, type EmptyStateOptions } from './EmptyState.js';

// ErrorState
export { createErrorState, errorStateHTML, type ErrorStateOptions } from './ErrorState.js';

// LoadingState
export { createLoadingState, loadingStateHTML, type LoadingStateOptions } from './LoadingState.js';

// Panel
export { createPanel, panelHTML, type PanelOptions, type PanelInstance } from './Panel.js';

// SplitView
export { createSplitView, splitViewHTML, type SplitViewOptions, type SplitViewInstance, type SplitDirection } from './SplitView.js';

// Stack
export { createStack, stackHTML, type StackOptions, type StackDirection } from './Stack.js';

// Grid
export { createGrid, gridHTML, type GridOptions } from './Grid.js';

// ScrollArea
export { createScrollArea, scrollAreaHTML, type ScrollAreaOptions } from './ScrollArea.js';

// Divider
export { createDivider, dividerHTML, type DividerOptions } from './Divider.js';