// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module application-extension
 */

import {
  IConnectionLost,
  ILabShell,
  ILabStatus,
  ILayoutRestorer,
  IRouter,
  ITreePathUpdater,
  ConnectionLost,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  JupyterFrontEndContextMenu,
  JupyterLab,
  LabShell,
  LayoutRestorer,
  Router
} from '@jupyterlab/application';

import {
  Dialog,
  ICommandPalette,
  IWindowResolver,
  showDialog,
  showErrorMessage
} from '@jupyterlab/apputils';

import { URLExt, PageConfig } from '@jupyterlab/coreutils';

import {
  IPropertyInspectorProvider,
  SideBarPropertyInspectorProvider
} from '@jupyterlab/property-inspector';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IStateDB } from '@jupyterlab/statedb';

import { ITranslator, TranslationBundle } from '@jupyterlab/translation';

import { buildIcon, jupyterIcon } from '@jupyterlab/ui-components';

import { each, iter, toArray } from '@lumino/algorithm';

import { PromiseDelegate } from '@lumino/coreutils';

import { DisposableDelegate, DisposableSet } from '@lumino/disposable';

import { Widget, DockLayout, DockPanel } from '@lumino/widgets';

import * as React from 'react';

/**
 * The command IDs used by the application plugin.
 */
namespace CommandIDs {
  export const activateNextTab: string = 'application:activate-next-tab';

  export const activatePreviousTab: string =
    'application:activate-previous-tab';

  export const activateNextTabBar: string = 'application:activate-next-tab-bar';

  export const activatePreviousTabBar: string =
    'application:activate-previous-tab-bar';

  export const close = 'application:close';

  export const closeOtherTabs = 'application:close-other-tabs';

  export const closeRightTabs = 'application:close-right-tabs';

  export const closeAll: string = 'application:close-all';

  export const setMode: string = 'application:set-mode';

  export const toggleMode: string = 'application:toggle-mode';

  export const toggleLeftArea: string = 'application:toggle-left-area';

  export const toggleRightArea: string = 'application:toggle-right-area';

  export const togglePresentationMode: string =
    'application:toggle-presentation-mode';

  export const tree: string = 'router:tree';

  export const switchSidebar = 'sidebar:switch';
}

/**
 * The main extension.
 */
const main: JupyterFrontEndPlugin<ITreePathUpdater> = {
  id: '@jupyterlab/application-extension:main',
  requires: [IRouter, IWindowResolver, ITranslator],
  optional: [ICommandPalette, IConnectionLost],
  provides: ITreePathUpdater,
  activate: (
    app: JupyterFrontEnd,
    router: IRouter,
    resolver: IWindowResolver,
    translator: ITranslator,
    palette: ICommandPalette | null,
    connectionLost: IConnectionLost | null
  ) => {
    const trans = translator.load('jupyterlab');

    if (!(app instanceof JupyterLab)) {
      throw new Error(`${main.id} must be activated in JupyterLab.`);
    }

    // These two internal state variables are used to manage the two source
    // of the tree part of the URL being updated: 1) path of the active document,
    // 2) path of the default browser if the active main area widget isn't a document.
    let _docTreePath = '';
    let _defaultBrowserTreePath = '';

    function updateTreePath(treePath: string) {
      _defaultBrowserTreePath = treePath;
      if (!_docTreePath) {
        const path = PageConfig.getUrl({ treePath });
        router.navigate(path, { skipRouting: true });
        // Persist the new tree path to PageConfig as it is used elsewhere at runtime.
        PageConfig.setOption('treePath', treePath);
      }
    }

    // Requiring the window resolver guarantees that the application extension
    // only loads if there is a viable window name. Otherwise, the application
    // will short-circuit and ask the user to navigate away.
    const workspace = resolver.name;

    console.debug(`Starting application in workspace: "${workspace}"`);

    // If there were errors registering plugins, tell the user.
    if (app.registerPluginErrors.length !== 0) {
      const body = (
        <pre>{app.registerPluginErrors.map(e => e.message).join('\n')}</pre>
      );

      void showErrorMessage(trans.__('Error Registering Plugins'), {
        message: body
      });
    }

    addCommands(app, palette, trans);

    // If the application shell layout is modified,
    // trigger a refresh of the commands.
    app.shell.layoutModified.connect(() => {
      app.commands.notifyCommandChanged();
    });

    // Watch the mode and update the page URL to /lab or /doc to reflect the
    // change.
    app.shell.modeChanged.connect((_, args: DockPanel.Mode) => {
      const path = PageConfig.getUrl({ mode: args as string });
      router.navigate(path, { skipRouting: true });
      // Persist this mode change to PageConfig as it is used elsewhere at runtime.
      PageConfig.setOption('mode', args as string);
    });

    // Watch the path of the current widget in the main area and update the page
    // URL to reflect the change.
    app.shell.currentPathChanged.connect((_, args) => {
      const maybeTreePath = args.newValue as string;
      const treePath = maybeTreePath || _defaultBrowserTreePath;
      const path = PageConfig.getUrl({ treePath: treePath });
      router.navigate(path, { skipRouting: true });
      // Persist the new tree path to PageConfig as it is used elsewhere at runtime.
      PageConfig.setOption('treePath', treePath);
      _docTreePath = maybeTreePath;
    });

    // If the connection to the server is lost, handle it with the
    // connection lost handler.
    connectionLost = connectionLost || ConnectionLost;
    app.serviceManager.connectionFailure.connect((manager, error) =>
      connectionLost!(manager, error, translator)
    );

    const builder = app.serviceManager.builder;
    const build = () => {
      return builder
        .build()
        .then(() => {
          return showDialog({
            title: trans.__('Build Complete'),
            body: (
              <div>
                {trans.__('Build successfully completed, reload page?')}
                <br />
                {trans.__('You will lose any unsaved changes.')}
              </div>
            ),
            buttons: [
              Dialog.cancelButton({
                label: trans.__('Reload Without Saving'),
                actions: ['reload']
              }),
              Dialog.okButton({ label: trans.__('Save and Reload') })
            ],
            hasClose: true
          });
        })
        .then(({ button: { accept, actions } }) => {
          if (accept) {
            void app.commands
              .execute('docmanager:save')
              .then(() => {
                router.reload();
              })
              .catch(err => {
                void showErrorMessage(trans.__('Save Failed'), {
                  message: <pre>{err.message}</pre>
                });
              });
          } else if (actions.includes('reload')) {
            router.reload();
          }
        })
        .catch(err => {
          void showErrorMessage(trans.__('Build Failed'), {
            message: <pre>{err.message}</pre>
          });
        });
    };

    if (builder.isAvailable && builder.shouldCheck) {
      void builder.getStatus().then(response => {
        if (response.status === 'building') {
          return build();
        }

        if (response.status !== 'needed') {
          return;
        }

        const body = (
          <div>
            {trans.__('JupyterLab build is suggested:')}
            <br />
            <pre>{response.message}</pre>
          </div>
        );

        void showDialog({
          title: trans.__('Build Recommended'),
          body,
          buttons: [
            Dialog.cancelButton(),
            Dialog.okButton({ label: trans.__('Build') })
          ]
        }).then(result => (result.button.accept ? build() : undefined));
      });
    }

    const message = trans.__(
      'Are you sure you want to exit JupyterLab?\n\nAny unsaved changes will be lost.'
    );

    // The spec for the `beforeunload` event is implemented differently by
    // the different browser vendors. Consequently, the `event.returnValue`
    // attribute needs to set in addition to a return value being returned.
    // For more information, see:
    // https://developer.mozilla.org/en/docs/Web/Events/beforeunload
    window.addEventListener('beforeunload', event => {
      if (app.status.isDirty) {
        return ((event as any).returnValue = message);
      }
    });
    return updateTreePath;
  },
  autoStart: true
};

/**
 * The default layout restorer provider.
 */
const layout: JupyterFrontEndPlugin<ILayoutRestorer> = {
  id: '@jupyterlab/application-extension:layout',
  requires: [IStateDB, ILabShell],
  activate: (
    app: JupyterFrontEnd,
    state: IStateDB,
    labShell: ILabShell,
    info: JupyterLab.IInfo
  ) => {
    const first = app.started;
    const registry = app.commands;
    const restorer = new LayoutRestorer({ connector: state, first, registry });

    void restorer.fetch().then(saved => {
      labShell.restoreLayout(
        PageConfig.getOption('mode') as DockPanel.Mode,
        saved
      );
      labShell.layoutModified.connect(() => {
        void restorer.save(labShell.saveLayout());
      });
    });

    return restorer;
  },
  autoStart: true,
  provides: ILayoutRestorer
};

/**
 * The default URL router provider.
 */
const router: JupyterFrontEndPlugin<IRouter> = {
  id: '@jupyterlab/application-extension:router',
  requires: [JupyterFrontEnd.IPaths],
  activate: (app: JupyterFrontEnd, paths: JupyterFrontEnd.IPaths) => {
    const { commands } = app;
    const base = paths.urls.base;
    const router = new Router({ base, commands });

    void app.started.then(() => {
      // Route the very first request on load.
      void router.route();

      // Route all pop state events.
      window.addEventListener('popstate', () => {
        void router.route();
      });
    });

    return router;
  },
  autoStart: true,
  provides: IRouter
};

/**
 * The default tree route resolver plugin.
 */
const tree: JupyterFrontEndPlugin<JupyterFrontEnd.ITreeResolver> = {
  id: '@jupyterlab/application-extension:tree-resolver',
  autoStart: true,
  requires: [IRouter],
  provides: JupyterFrontEnd.ITreeResolver,
  activate: (
    app: JupyterFrontEnd,
    router: IRouter
  ): JupyterFrontEnd.ITreeResolver => {
    const { commands } = app;
    const set = new DisposableSet();
    const delegate = new PromiseDelegate<JupyterFrontEnd.ITreeResolver.Paths>();

    const treePattern = new RegExp(
      '/(lab|doc)(/workspaces/[a-zA-Z0-9-_]+)?(/tree/.*)?'
    );

    set.add(
      commands.addCommand(CommandIDs.tree, {
        execute: async (args: IRouter.ILocation) => {
          if (set.isDisposed) {
            return;
          }

          const query = URLExt.queryStringToObject(args.search ?? '');
          const browser = query['file-browser-path'] || '';

          // Remove the file browser path from the query string.
          delete query['file-browser-path'];

          // Clean up artifacts immediately upon routing.
          set.dispose();

          delegate.resolve({ browser, file: PageConfig.getOption('treePath') });
        }
      })
    );
    set.add(
      router.register({ command: CommandIDs.tree, pattern: treePattern })
    );

    // If a route is handled by the router without the tree command being
    // invoked, resolve to `null` and clean up artifacts.
    const listener = () => {
      if (set.isDisposed) {
        return;
      }
      set.dispose();
      delegate.resolve(null);
    };
    router.routed.connect(listener);
    set.add(
      new DisposableDelegate(() => {
        router.routed.disconnect(listener);
      })
    );

    return { paths: delegate.promise };
  }
};

/**
 * The default URL not found extension.
 */
const notfound: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/application-extension:notfound',
  requires: [JupyterFrontEnd.IPaths, IRouter, ITranslator],
  activate: (
    _: JupyterFrontEnd,
    paths: JupyterFrontEnd.IPaths,
    router: IRouter,
    translator: ITranslator
  ) => {
    const trans = translator.load('jupyterlab');
    const bad = paths.urls.notFound;

    if (!bad) {
      return;
    }

    const base = router.base;
    const message = trans.__(
      'The path: %1 was not found. JupyterLab redirected to: %2',
      bad,
      base
    );

    // Change the URL back to the base application URL.
    router.navigate('');

    void showErrorMessage(trans.__('Path Not Found'), { message });
  },
  autoStart: true
};

/**
 * Change the favicon changing based on the busy status;
 */
const busy: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/application-extension:faviconbusy',
  requires: [ILabStatus],
  activate: async (_: JupyterFrontEnd, status: ILabStatus) => {
    status.busySignal.connect((_, isBusy) => {
      const favicon = document.querySelector(
        `link[rel="icon"]${isBusy ? '.idle.favicon' : '.busy.favicon'}`
      ) as HTMLLinkElement;
      if (!favicon) {
        return;
      }
      const newFavicon = document.querySelector(
        `link${isBusy ? '.busy.favicon' : '.idle.favicon'}`
      ) as HTMLLinkElement;
      if (!newFavicon) {
        return;
      }
      // If we have the two icons with the special classes, then toggle them.
      if (favicon !== newFavicon) {
        favicon.rel = '';
        newFavicon.rel = 'icon';

        // Firefox doesn't seem to recognize just changing rel, so we also
        // reinsert the link into the DOM.
        newFavicon.parentNode!.replaceChild(newFavicon, newFavicon);
      }
    });
  },
  autoStart: true
};

const SIDEBAR_ID = '@jupyterlab/application-extension:sidebar';

/**
 * Keep user settings for where to show the side panels.
 */
const sidebar: JupyterFrontEndPlugin<void> = {
  id: SIDEBAR_ID,
  autoStart: true,
  requires: [ISettingRegistry, ILabShell, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    labShell: ILabShell,
    translator: ITranslator,
    info: JupyterLab.IInfo
  ) => {
    const trans = translator.load('jupyterlab');
    type overrideMap = { [id: string]: 'left' | 'right' };
    let overrides: overrideMap = {};
    // const trans = translator.load("jupyterlab");
    const handleLayoutOverrides = () => {
      each(labShell.widgets('left'), widget => {
        if (overrides[widget.id] && overrides[widget.id] === 'right') {
          labShell.add(widget, 'right');
        }
      });
      each(labShell.widgets('right'), widget => {
        if (overrides[widget.id] && overrides[widget.id] === 'left') {
          labShell.add(widget, 'left');
        }
      });
    };
    labShell.layoutModified.connect(handleLayoutOverrides);
    // Fetch overrides from the settings system.
    void Promise.all([settingRegistry.load(SIDEBAR_ID), app.restored]).then(
      ([settings]) => {
        overrides = (settings.get('overrides').composite as overrideMap) || {};
        settings.changed.connect(settings => {
          overrides =
            (settings.get('overrides').composite as overrideMap) || {};
          handleLayoutOverrides();
        });
      }
    );

    // Add a command to switch a side panels's side
    app.commands.addCommand(CommandIDs.switchSidebar, {
      label: trans.__('Switch Sidebar Side'),
      execute: () => {
        // First, try to find the correct panel based on the
        // application context menu click.
        const contextNode: HTMLElement | undefined = app.contextMenuHitTest(
          node => !!node.dataset.id
        );
        let id: string;
        let side: 'left' | 'right';
        if (contextNode) {
          id = contextNode.dataset['id']!;
          const leftPanel = document.getElementById('jp-left-stack');
          const node = document.getElementById(id);
          if (leftPanel && node && leftPanel.contains(node)) {
            side = 'right';
          } else {
            side = 'left';
          }
        } else {
          // Bail if we don't find a sidebar for the widget.
          return;
        }
        // Move the panel to the other side.
        const newOverrides = { ...overrides };
        newOverrides[id] = side;
        return settingRegistry.set(SIDEBAR_ID, 'overrides', newOverrides);
      }
    });

    // Add a context menu item to sidebar tabs.
    app.contextMenu.addItem({
      command: CommandIDs.switchSidebar,
      selector: '.jp-SideBar .lm-TabBar-tab',
      rank: 500
    });
  }
};

/**
 * Add the main application commands.
 */
function addCommands(
  app: JupyterLab,
  palette: ICommandPalette | null,
  trans: TranslationBundle
): void {
  const { commands, contextMenu, shell } = app;
  const category = trans.__('Main Area');

  // Add Command to override the JLab context menu.
  commands.addCommand(JupyterFrontEndContextMenu.contextMenu, {
    label: trans.__('Shift+Right Click for Browser Menu'),
    isEnabled: () => false,
    execute: () => void 0
  });

  app.contextMenu.addItem({
    command: JupyterFrontEndContextMenu.contextMenu,
    selector: 'body',
    rank: Infinity // At the bottom always
  });

  // Returns the widget associated with the most recent contextmenu event.
  const contextMenuWidget = (): Widget | null => {
    const test = (node: HTMLElement) => !!node.dataset.id;
    const node = app.contextMenuHitTest(test);

    if (!node) {
      // Fall back to active widget if path cannot be obtained from event.
      return shell.currentWidget;
    }

    const matches = toArray(shell.widgets('main')).filter(
      widget => widget.id === node.dataset.id
    );

    if (matches.length < 1) {
      return shell.currentWidget;
    }

    return matches[0];
  };

  // Closes an array of widgets.
  const closeWidgets = (widgets: Array<Widget>): void => {
    widgets.forEach(widget => widget.close());
  };

  // Find the tab area for a widget within a specific dock area.
  const findTab = (
    area: DockLayout.AreaConfig,
    widget: Widget
  ): DockLayout.ITabAreaConfig | null => {
    switch (area.type) {
      case 'split-area': {
        const iterator = iter(area.children);
        let tab: DockLayout.ITabAreaConfig | null = null;
        let value: DockLayout.AreaConfig | undefined;
        do {
          value = iterator.next();
          if (value) {
            tab = findTab(value, widget);
          }
        } while (!tab && value);
        return tab;
      }
      case 'tab-area': {
        const { id } = widget;
        return area.widgets.some(widget => widget.id === id) ? area : null;
      }
      default:
        return null;
    }
  };

  // Find the tab area for a widget within the main dock area.
  const tabAreaFor = (widget: Widget): DockLayout.ITabAreaConfig | null => {
    const { mainArea } = shell.saveLayout();
    if (!mainArea || PageConfig.getOption('mode') !== 'multiple-document') {
      return null;
    }
    const area = mainArea.dock?.main;
    if (!area) {
      return null;
    }
    return findTab(area, widget);
  };

  // Returns an array of all widgets to the right of a widget in a tab area.
  const widgetsRightOf = (widget: Widget): Array<Widget> => {
    const { id } = widget;
    const tabArea = tabAreaFor(widget);
    const widgets = tabArea ? tabArea.widgets || [] : [];
    const index = widgets.findIndex(widget => widget.id === id);
    if (index < 0) {
      return [];
    }
    return widgets.slice(index + 1);
  };

  commands.addCommand(CommandIDs.activateNextTab, {
    label: trans.__('Activate Next Tab'),
    execute: () => {
      shell.activateNextTab();
    }
  });

  commands.addCommand(CommandIDs.activatePreviousTab, {
    label: trans.__('Activate Previous Tab'),
    execute: () => {
      shell.activatePreviousTab();
    }
  });

  commands.addCommand(CommandIDs.activateNextTabBar, {
    label: trans.__('Activate Next Tab Bar'),
    execute: () => {
      shell.activateNextTabBar();
    }
  });

  commands.addCommand(CommandIDs.activatePreviousTabBar, {
    label: trans.__('Activate Previous Tab Bar'),
    execute: () => {
      shell.activatePreviousTabBar();
    }
  });

  // A CSS selector targeting tabs in the main area. This is a very
  // specific selector since we really only want tabs that are
  // in the main area, as opposed to those in sidebars, ipywidgets, etc.
  const tabSelector =
    '#jp-main-dock-panel .lm-DockPanel-tabBar.jp-Activity .lm-TabBar-tab';

  commands.addCommand(CommandIDs.close, {
    label: () => trans.__('Close Tab'),
    isEnabled: () => {
      const widget = contextMenuWidget();
      return !!widget && widget.title.closable;
    },
    execute: () => {
      const widget = contextMenuWidget();
      if (widget) {
        widget.close();
      }
    }
  });
  contextMenu.addItem({
    command: CommandIDs.close,
    selector: tabSelector,
    rank: 4
  });

  commands.addCommand(CommandIDs.closeAll, {
    label: trans.__('Close All Tabs'),
    execute: () => {
      shell.closeAll();
    }
  });

  commands.addCommand(CommandIDs.closeOtherTabs, {
    label: () => trans.__('Close All Other Tabs'),
    isEnabled: () => {
      // Ensure there are at least two widgets.
      const iterator = shell.widgets('main');
      return !!iterator.next() && !!iterator.next();
    },
    execute: () => {
      const widget = contextMenuWidget();
      if (!widget) {
        return;
      }
      const { id } = widget;
      const otherWidgets = toArray(shell.widgets('main')).filter(
        widget => widget.id !== id
      );
      closeWidgets(otherWidgets);
    }
  });
  contextMenu.addItem({
    command: CommandIDs.closeOtherTabs,
    selector: tabSelector,
    rank: 4
  });

  commands.addCommand(CommandIDs.closeRightTabs, {
    label: () => trans.__('Close Tabs to Right'),
    isEnabled: () =>
      !!contextMenuWidget() && widgetsRightOf(contextMenuWidget()!).length > 0,
    execute: () => {
      const widget = contextMenuWidget();
      if (!widget) {
        return;
      }
      closeWidgets(widgetsRightOf(widget));
    }
  });
  contextMenu.addItem({
    command: CommandIDs.closeRightTabs,
    selector: tabSelector,
    rank: 5
  });

  app.commands.addCommand(CommandIDs.toggleLeftArea, {
    label: () => trans.__('Show Left Sidebar'),
    execute: () => {
      if (shell.leftCollapsed) {
        shell.expandLeft();
      } else {
        shell.collapseLeft();
        if (shell.currentWidget) {
          shell.activateById(shell.currentWidget.id);
        }
      }
    },
    isToggled: () => !shell.leftCollapsed,
    isVisible: () => !shell.isEmpty('left')
  });

  app.commands.addCommand(CommandIDs.toggleRightArea, {
    label: () => trans.__('Show Right Sidebar'),
    execute: () => {
      if (shell.rightCollapsed) {
        shell.expandRight();
      } else {
        shell.collapseRight();
        if (shell.currentWidget) {
          shell.activateById(shell.currentWidget.id);
        }
      }
    },
    isToggled: () => !shell.rightCollapsed,
    isVisible: () => !shell.isEmpty('right')
  });

  app.commands.addCommand(CommandIDs.togglePresentationMode, {
    label: () => trans.__('Presentation Mode'),
    execute: () => {
      shell.presentationMode = !shell.presentationMode;
    },
    isToggled: () => shell.presentationMode,
    isVisible: () => true
  });

  app.commands.addCommand(CommandIDs.setMode, {
    isVisible: args => {
      const mode = args['mode'] as string;
      return mode === 'single-document' || mode === 'multiple-document';
    },
    execute: args => {
      const mode = args['mode'] as string;
      if (mode === 'single-document' || mode === 'multiple-document') {
        shell.mode = mode;
        return;
      }
      throw new Error(`Unsupported application shell mode: ${mode}`);
    }
  });

  app.commands.addCommand(CommandIDs.toggleMode, {
    label: trans.__('Simple Interface'),
    isToggled: () => shell.mode === 'single-document',
    execute: () => {
      const args =
        shell.mode === 'multiple-document'
          ? { mode: 'single-document' }
          : { mode: 'multiple-document' };
      return app.commands.execute(CommandIDs.setMode, args);
    }
  });

  if (palette) {
    palette.addItem({ command: CommandIDs.activateNextTab, category });
    palette.addItem({ command: CommandIDs.activatePreviousTab, category });
    palette.addItem({ command: CommandIDs.activateNextTabBar, category });
    palette.addItem({ command: CommandIDs.activatePreviousTabBar, category });
    palette.addItem({ command: CommandIDs.close, category });
    palette.addItem({ command: CommandIDs.closeAll, category });
    palette.addItem({ command: CommandIDs.closeOtherTabs, category });
    palette.addItem({ command: CommandIDs.closeRightTabs, category });
    palette.addItem({ command: CommandIDs.toggleLeftArea, category });
    palette.addItem({ command: CommandIDs.toggleRightArea, category });
    palette.addItem({ command: CommandIDs.togglePresentationMode, category });
    palette.addItem({ command: CommandIDs.toggleMode, category });
  }
}

/**
 * The default JupyterLab application shell.
 */
const shell: JupyterFrontEndPlugin<ILabShell> = {
  id: '@jupyterlab/application-extension:shell',
  activate: (app: JupyterFrontEnd) => {
    if (!(app.shell instanceof LabShell)) {
      throw new Error(`${shell.id} did not find a LabShell instance.`);
    }
    return app.shell;
  },
  autoStart: true,
  provides: ILabShell
};

/**
 * The default JupyterLab application status provider.
 */
const status: JupyterFrontEndPlugin<ILabStatus> = {
  id: '@jupyterlab/application-extension:status',
  activate: (app: JupyterFrontEnd) => {
    if (!(app instanceof JupyterLab)) {
      throw new Error(`${status.id} must be activated in JupyterLab.`);
    }
    return app.status;
  },
  autoStart: true,
  provides: ILabStatus
};

/**
 * The default JupyterLab application-specific information provider.
 *
 * #### Notes
 * This plugin should only be used by plugins that specifically need to access
 * JupyterLab application information, e.g., listing extensions that have been
 * loaded or deferred within JupyterLab.
 */
const info: JupyterFrontEndPlugin<JupyterLab.IInfo> = {
  id: '@jupyterlab/application-extension:info',
  activate: (app: JupyterFrontEnd) => {
    if (!(app instanceof JupyterLab)) {
      throw new Error(`${info.id} must be activated in JupyterLab.`);
    }
    return app.info;
  },
  autoStart: true,
  provides: JupyterLab.IInfo
};

/**
 * The default JupyterLab paths dictionary provider.
 */
const paths: JupyterFrontEndPlugin<JupyterFrontEnd.IPaths> = {
  id: '@jupyterlab/apputils-extension:paths',
  activate: (app: JupyterFrontEnd): JupyterFrontEnd.IPaths => {
    if (!(app instanceof JupyterLab)) {
      throw new Error(`${paths.id} must be activated in JupyterLab.`);
    }
    return app.paths;
  },
  autoStart: true,
  provides: JupyterFrontEnd.IPaths
};

/**
 * The default property inspector provider.
 */
const propertyInspector: JupyterFrontEndPlugin<IPropertyInspectorProvider> = {
  id: '@jupyterlab/application-extension:property-inspector',
  autoStart: true,
  requires: [ILabShell, ITranslator],
  optional: [ILayoutRestorer],
  provides: IPropertyInspectorProvider,
  activate: (
    app: JupyterFrontEnd,
    labshell: ILabShell,
    translator: ITranslator,
    restorer: ILayoutRestorer | null
  ) => {
    const trans = translator.load('jupyterlab');
    const widget = new SideBarPropertyInspectorProvider(
      labshell,
      undefined,
      translator
    );
    widget.title.icon = buildIcon;
    widget.title.caption = trans.__('Property Inspector');
    widget.id = 'jp-property-inspector';
    labshell.add(widget, 'right', { rank: 100 });
    if (restorer) {
      restorer.add(widget, 'jp-property-inspector');
    }
    return widget;
  }
};

const JupyterLogo: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/application-extension:logo',
  autoStart: true,
  requires: [ILabShell],
  activate: (app: JupyterFrontEnd, shell: ILabShell) => {
    const logo = new Widget();
    jupyterIcon.element({
      container: logo.node,
      elementPosition: 'center',
      margin: '2px 2px 2px 8px',
      height: 'auto',
      width: '16px'
    });
    logo.id = 'jp-MainLogo';
    shell.add(logo, 'top', { rank: 0 });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  main,
  layout,
  router,
  tree,
  notfound,
  busy,
  sidebar,
  shell,
  status,
  info,
  paths,
  propertyInspector,
  JupyterLogo
];

export default plugins;
