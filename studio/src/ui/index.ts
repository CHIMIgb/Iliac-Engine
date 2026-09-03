/**
 * ui/index.ts — Barrel export de todos los componentes UI
 */

// Icon
export { createIcon, iconHTML, listIcons } from './Icon.js';

// Button
export { createButton, buttonHTML, type ButtonOptions, type ButtonVariant, type ButtonSize } from './Button.js';
export { buttonCSS } from './Button.js';

// Input
export { createInput, inputHTML, type InputOptions, type InputType } from './Input.js';
export { inputCSS } from './Input.js';

// Tabs
export { createTabs, tabsHTML, type TabsOptions, type TabItem } from './Tabs.js';
export { tabsCSS } from './Tabs.js';

// Table
export { createTable, tableHTML, type TableOptions, type TableColumn } from './Table.js';
export { tableCSS } from './Table.js';

// Modal
export { createModal, closeTopModal, closeAllModals, type ModalOptions, type ModalInstance } from './Modal.js';
export { modalCSS } from './Modal.js';

// Toast
export { showToast, closeAllToasts, toast, type ToastOptions, type ToastVariant } from './Toast.js';
export { toastCSS } from './Toast.js';

// Spinner
export { createSpinner, spinnerHTML, type SpinnerOptions, type SpinnerSize } from './Spinner.js';
export { spinnerCSS } from './Spinner.js';

// Skeleton
export { createSkeleton, skeletonHTML, type SkeletonOptions } from './Skeleton.js';
export { skeletonCSS } from './Skeleton.js';

// ProgressBar
export { createProgressBar, progressBarHTML, type ProgressBarOptions } from './ProgressBar.js';
export { progressCSS } from './ProgressBar.js';

// EmptyState
export { createEmptyState, emptyStateHTML, type EmptyStateOptions } from './EmptyState.js';
export { emptyCSS } from './EmptyState.js';

// ErrorState
export { createErrorState, errorStateHTML, type ErrorStateOptions } from './ErrorState.js';
export { errorCSS } from './ErrorState.js';

// LoadingState
export { createLoadingState, loadingStateHTML, type LoadingStateOptions } from './LoadingState.js';
export { loadingCSS } from './LoadingState.js';

// Panel
export { createPanel, panelHTML, type PanelOptions, type PanelInstance } from './Panel.js';
export { panelCSS } from './Panel.js';

// SplitView
export { createSplitView, splitViewHTML, type SplitViewOptions, type SplitViewInstance, type SplitDirection } from './SplitView.js';
export { splitCSS } from './SplitView.js';

// Stack
export { createStack, stackHTML, type StackOptions, type StackDirection } from './Stack.js';
export { stackCSS } from './Stack.js';

// Grid
export { createGrid, gridHTML, type GridOptions } from './Grid.js';
export { gridCSS } from './Grid.js';

// ScrollArea
export { createScrollArea, scrollAreaHTML, type ScrollAreaOptions } from './ScrollArea.js';
export { scrollAreaCSS } from './ScrollArea.js';

// Divider
export { createDivider, dividerHTML, type DividerOptions } from './Divider.js';
export { dividerCSS } from './Divider.js';

// CSS combinado para inyección única
export const uiCSS = `
${buttonCSS}
${inputCSS}
${tabsCSS}
${tableCSS}
${modalCSS}
${toastCSS}
${spinnerCSS}
${skeletonCSS}
${progressCSS}
${emptyCSS}
${errorCSS}
${loadingCSS}
${panelCSS}
${splitCSS}
${stackCSS}
${gridCSS}
${scrollAreaCSS}
${dividerCSS}
`;