// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { MenuSvg } from '@jupyterlab/ui-components';

import { ArrayExt } from '@lumino/algorithm';

import { CommandRegistry } from '@lumino/commands';

import { Menu, MenuBar } from '@lumino/widgets';

import { FileMenu } from './file';

import { EditMenu } from './edit';

import { HelpMenu } from './help';

import { KernelMenu } from './kernel';

import { RunMenu } from './run';

import { SettingsMenu } from './settings';

import { ViewMenu } from './view';

import { TabsMenu } from './tabs';

import { IMainMenu } from './tokens';

/**
 * The main menu class.  It is intended to be used as a singleton.
 */
export class MainMenu extends MenuBar implements IMainMenu {
  /**
   * Construct the main menu bar.
   */
  constructor(commands: CommandRegistry) {
    super();
    this.editMenu = new EditMenu({ commands });
    this.fileMenu = new FileMenu({ commands });
    this.helpMenu = new HelpMenu({ commands });
    this.kernelMenu = new KernelMenu({ commands });
    this.runMenu = new RunMenu({ commands });
    this.settingsMenu = new SettingsMenu({ commands });
    this.viewMenu = new ViewMenu({ commands });
    this.tabsMenu = new TabsMenu({ commands });

    this.addMenu(this.fileMenu.menu, { rank: 1 });
    this.addMenu(this.editMenu.menu, { rank: 2 });
    this.addMenu(this.viewMenu.menu, { rank: 3 });
    this.addMenu(this.runMenu.menu, { rank: 4 });
    this.addMenu(this.kernelMenu.menu, { rank: 5 });
    this.addMenu(this.tabsMenu.menu, { rank: 500 });
    this.addMenu(this.settingsMenu.menu, { rank: 999 });
    this.addMenu(this.helpMenu.menu, { rank: 1000 });
  }

  /**
   * The application "Edit" menu.
   */
  readonly editMenu: EditMenu;

  /**
   * The application "File" menu.
   */
  readonly fileMenu: FileMenu;

  /**
   * The application "Help" menu.
   */
  readonly helpMenu: HelpMenu;

  /**
   * The application "Kernel" menu.
   */
  readonly kernelMenu: KernelMenu;

  /**
   * The application "Run" menu.
   */
  readonly runMenu: RunMenu;

  /**
   * The application "Settings" menu.
   */
  readonly settingsMenu: SettingsMenu;

  /**
   * The application "View" menu.
   */
  readonly viewMenu: ViewMenu;

  /**
   * The application "Tabs" menu.
   */
  readonly tabsMenu: TabsMenu;

  /**
   * Add a new menu to the main menu bar.
   */
  addMenu(menu: Menu, options: IMainMenu.IAddOptions = {}): void {
    // override default renderer with svg-supporting renderer
    MenuSvg.overrideDefaultRenderer(menu);

    if (ArrayExt.firstIndexOf(this.menus, menu) > -1) {
      return;
    }

    const rank = 'rank' in options ? options.rank : 100;
    const rankItem = { menu, rank };
    const index = ArrayExt.upperBound(this._items, rankItem, Private.itemCmp);

    // Upon disposal, remove the menu and its rank reference.
    menu.disposed.connect(this._onMenuDisposed, this);

    ArrayExt.insert(this._items, index, rankItem);
    /**
     * Create a new menu.
     */
    this.insertMenu(index, menu);
  }

  /**
   * Dispose of the resources held by the menu bar.
   */
  dispose(): void {
    this.editMenu.dispose();
    this.fileMenu.dispose();
    this.helpMenu.dispose();
    this.kernelMenu.dispose();
    this.runMenu.dispose();
    this.settingsMenu.dispose();
    this.viewMenu.dispose();
    this.tabsMenu.dispose();
    super.dispose();
  }

  /**
   * Handle the disposal of a menu.
   */
  private _onMenuDisposed(menu: Menu): void {
    this.removeMenu(menu);
    const index = ArrayExt.findFirstIndex(
      this._items,
      item => item.menu === menu
    );
    if (index !== -1) {
      ArrayExt.removeAt(this._items, index);
    }
  }

  private _items: Private.IRankItem[] = [];
}

/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * An object which holds a menu and its sort rank.
   */
  export interface IRankItem {
    /**
     * The menu for the item.
     */
    menu: Menu;

    /**
     * The sort rank of the menu.
     */
    rank: number;
  }

  /**
   * A comparator function for menu rank items.
   */
  export function itemCmp(first: IRankItem, second: IRankItem): number {
    return first.rank - second.rank;
  }
}
