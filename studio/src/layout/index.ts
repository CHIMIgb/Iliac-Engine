/**
 * layout/index.ts — Barrel export de componentes de layout
 */

export { createToolbar, toolbarHTML, type ToolbarOptions } from './Toolbar.js';
export { createStatusBar, statusBarHTML, type StatusBarOptions, type StatusBarItem } from './StatusBar.js';
export { createBottomTabs, bottomTabsHTML, type BottomTabsOptions, type BottomTabsInstance, type BottomTabItem } from './BottomTabs.js';
export { createAppLayout, type AppLayoutOptions, type AppLayoutInstance } from './AppLayout.js';